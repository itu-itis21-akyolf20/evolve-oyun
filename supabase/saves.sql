-- ============================================================
-- EVOLVE bulut kaydı — Supabase SQL Editor'de BİR KEZ çalıştır.
--
-- Oyun kaydı oyuncu kimliğine (kayıt koduna) bağlı saklanır. Kod
-- rastgele ve tahmin edilemez; kodu bilen o kayda devam edebilir.
-- Tabloya dışarıdan doğrudan erişim YOK, sadece iki fonksiyon:
--   save_game(p_id, p_data)  → kaydı yazar (en fazla 64 KB, 5 sn'de bir)
--   load_game(p_id)          → kaydı döner (yoksa null)
-- ============================================================

create table if not exists public.saves (
  id         text primary key check (id ~ '^[a-z0-9]{8,32}$'),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;        -- politika yok = doğrudan erişim yok
revoke all on public.saves from anon, authenticated, public;

create or replace function public.save_game(p_id text, p_data jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old timestamptz;
begin
  if p_id is null or p_id !~ '^[a-z0-9]{8,32}$' then
    return jsonb_build_object('error', 'geçersiz');
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 65536 then
    return jsonb_build_object('error', 'geçersiz');
  end if;
  select updated_at into v_old from public.saves where id = p_id;
  if found then
    if now() - v_old < interval '5 seconds' then
      return jsonb_build_object('error', 'yavaş');
    end if;
    update public.saves set data = p_data, updated_at = now() where id = p_id;
  else
    if (select count(*) from public.saves) >= 20000 then
      return jsonb_build_object('error', 'dolu');
    end if;
    insert into public.saves (id, data) values (p_id, p_data);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.load_game(p_id text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select data from public.saves where id = p_id and p_id ~ '^[a-z0-9]{8,32}$';
$$;

revoke all on function public.save_game(text, jsonb) from public;
revoke all on function public.load_game(text) from public;
grant execute on function public.save_game(text, jsonb) to anon, authenticated;
grant execute on function public.load_game(text) to anon, authenticated;
