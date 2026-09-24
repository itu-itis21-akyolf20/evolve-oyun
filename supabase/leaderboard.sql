-- ============================================================
-- EVOLVE liderlik tablosu — Supabase SQL Editor'de BİR KEZ çalıştır.
--
-- Tabloya dışarıdan doğrudan okuma/yazma YOK. Oyun sadece iki
-- fonksiyonu çağırır:
--   submit_score(...)     → doğrular, puanı kendisi hesaplar,
--                           oyuncu başına en iyi skoru tutar
--   get_leaderboard(p_id) → en iyi 50 (oyuncu kimlikleri gizli)
-- Puan formülü js/online.js score() ile aynı olmalı.
-- ============================================================

create table if not exists public.scores (
  id         text primary key check (id ~ '^[a-z0-9]{8,32}$'),
  name       text   not null,
  score      bigint not null default 0,
  stage      int    not null default 0,
  gen        int    not null default 0,
  kills      bigint not null default 0,
  total_dmg  bigint not null default 0,
  max_hit    bigint not null default 0,
  diff       text   not null default 'normal',
  updated_at timestamptz not null default now()
);
create index if not exists scores_score_idx on public.scores (score desc);
create index if not exists scores_updated_idx on public.scores (updated_at);

alter table public.scores enable row level security;       -- politika yok = doğrudan erişim yok
revoke all on public.scores from anon, authenticated, public;

create or replace function public.submit_score(
  p_id text, p_name text, p_stage int, p_gen int, p_kills bigint,
  p_total_dmg bigint, p_max_hit bigint, p_diff text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name  text;
  v_stage int    := greatest(0, least(coalesce(p_stage, 0), 2));
  v_gen   int    := greatest(0, least(coalesce(p_gen, 0), 200));
  v_kills bigint := greatest(0, least(coalesce(p_kills, 0), 100000000));
  v_dmg   bigint := greatest(0, least(coalesce(p_total_dmg, 0), 1000000000000000));
  v_max   bigint := greatest(0, least(coalesce(p_max_hit, 0), 10000000000000));
  v_diff  text   := case when p_diff = 'dehset' then 'dehset' else 'normal' end;
  v_score bigint;
  v_old   public.scores;
  v_best  bigint;
begin
  if p_id is null or p_id !~ '^[a-z0-9]{8,32}$' then
    return jsonb_build_object('error', 'geçersiz');
  end if;
  -- kontrol karakterleri ve HTML işaretleri atılır (istemci de temizliyor)
  v_name := left(btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>"''&\\/`]', '', 'g'), '\s+', ' ', 'g')), 16);
  if char_length(v_name) < 2 then
    return jsonb_build_object('error', 'geçersiz');
  end if;
  v_max := least(v_max, v_dmg);                               -- tek vuruş toplamı geçemez
  v_score := floor((v_kills * 10 + floor(v_dmg / 50) + (v_stage + v_gen) * 10000)
                   * case when v_diff = 'dehset' then 1.5 else 1 end);

  -- genel sel koruması: saniyede en fazla 30 gönderim
  if (select count(*) from public.scores where updated_at > now() - interval '1 second') > 30 then
    return jsonb_build_object('error', 'yavaş');
  end if;

  select * into v_old from public.scores where id = p_id for update;
  if found then
    if now() - v_old.updated_at < interval '2.5 seconds' then  -- oyuncu başına hız sınırı
      return jsonb_build_object('error', 'yavaş');
    end if;
    if v_score >= v_old.score then
      update public.scores set name = v_name, score = v_score, stage = v_stage, gen = v_gen, kills = v_kills,
        total_dmg = v_dmg, max_hit = v_max, diff = v_diff, updated_at = now() where id = p_id;
    else                                                      -- en iyi skor kalır; isim her zaman güncellenir
      update public.scores set name = v_name, max_hit = greatest(max_hit, v_max),
        total_dmg = greatest(total_dmg, v_dmg), updated_at = now() where id = p_id;
    end if;
  else
    if (select count(*) from public.scores) >= 20000 then
      return jsonb_build_object('error', 'dolu');
    end if;
    insert into public.scores (id, name, score, stage, gen, kills, total_dmg, max_hit, diff)
      values (p_id, v_name, v_score, v_stage, v_gen, v_kills, v_dmg, v_max, v_diff);
  end if;

  select score into v_best from public.scores where id = p_id;
  return jsonb_build_object('ok', true, 'best', v_best,
    'rank', (select count(*) from public.scores where score > v_best) + 1);
end $$;

create or replace function public.get_leaderboard(p_id text default '')
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', name, 'score', score, 'stage', stage, 'gen', gen, 'kills', kills,
        'totalDmg', total_dmg, 'maxHit', max_hit, 'diff', diff, 'me', id = p_id) order by score desc)
      from (select * from public.scores order by score desc limit 50) t), '[]'::jsonb),
    'total', (select count(*) from public.scores),
    'rank', (select count(*) + 1 from public.scores s
             where s.score > (select score from public.scores where id = p_id)
             having exists (select 1 from public.scores where id = p_id))
  );
$$;

revoke all on function public.submit_score(text, text, int, int, bigint, bigint, bigint, text) from public;
revoke all on function public.get_leaderboard(text) from public;
grant execute on function public.submit_score(text, text, int, int, bigint, bigint, bigint, text) to anon, authenticated;
grant execute on function public.get_leaderboard(text) to anon, authenticated;
