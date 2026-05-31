-- Add covering indexes for foreign keys introduced by Owner Super Admin mode.

do $$
declare
  foreign_key record;
begin
  for foreign_key in
    select table_class.relname as table_name, attribute.attname as column_name
    from pg_constraint constraint_row
    join pg_class table_class on table_class.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = table_class.relnamespace
    join pg_attribute attribute
      on attribute.attrelid = constraint_row.conrelid
      and attribute.attnum = constraint_row.conkey[1]
    where constraint_row.contype = 'f'
      and namespace_row.nspname = 'public'
      and array_length(constraint_row.conkey, 1) = 1
      and not exists (
        select 1
        from pg_index index_row
        where index_row.indrelid = constraint_row.conrelid
          and index_row.indisvalid
          and index_row.indkey[0] = constraint_row.conkey[1]
      )
  loop
    execute format(
      'create index if not exists %I on public.%I (%I)',
      foreign_key.table_name || '_' || foreign_key.column_name || '_fk_idx',
      foreign_key.table_name,
      foreign_key.column_name
    );
  end loop;
end $$;
