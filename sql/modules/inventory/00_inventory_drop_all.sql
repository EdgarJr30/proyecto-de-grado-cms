-- =========================================================
-- INVENTORY RESET (DROP ALL OBJECTS)
-- =========================================================
-- ADVERTENCIA:
-- Este reset elimina TODO el módulo inventory.
-- Incluye tablas compartidas en este script (uoms, warehouses) si fueron creadas por inventory.
-- Ejecuta con cuidado en bases donde conviven otros módulos.

-- VIEWS
DROP VIEW IF EXISTS public.v_available_stock;
DROP VIEW IF EXISTS public.v_reorder_suggestions;
DROP VIEW IF EXISTS public.v_inventory_kardex;
DROP VIEW IF EXISTS public.v_stock_by_location;
DROP VIEW IF EXISTS public.v_part_stock_summary;

-- TABLES
DROP TABLE IF EXISTS public.inventory_doc_counters CASCADE;
DROP TABLE IF EXISTS public.part_costs CASCADE;
DROP TABLE IF EXISTS public.reorder_policies CASCADE;
DROP TABLE IF EXISTS public.ticket_part_requests CASCADE;
DROP TABLE IF EXISTS public.inventory_ledger CASCADE;
DROP TABLE IF EXISTS public.inventory_doc_lines CASCADE;
DROP TABLE IF EXISTS public.inventory_docs CASCADE;
DROP TABLE IF EXISTS public.stock_on_hand CASCADE;
DROP TABLE IF EXISTS public.warehouse_bins CASCADE;
DROP TABLE IF EXISTS public.part_vendors CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;
DROP TABLE IF EXISTS public.parts CASCADE;
DROP TABLE IF EXISTS public.part_categories CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;
DROP TABLE IF EXISTS public.uoms CASCADE;

-- FUNCTIONS (inventory)
DROP FUNCTION IF EXISTS public.release_ticket_part_reservation(bigint, uuid, uuid, numeric);
DROP FUNCTION IF EXISTS public.return_ticket_part(bigint, uuid, uuid, numeric, uuid, text, text);
DROP FUNCTION IF EXISTS public.issue_ticket_part(bigint, uuid, uuid, numeric, uuid, text, text);
DROP FUNCTION IF EXISTS public.cancel_inventory_doc(uuid);
DROP FUNCTION IF EXISTS public.create_reversal_doc(uuid);
DROP FUNCTION IF EXISTS public.reserve_ticket_part(bigint, uuid, uuid, numeric, boolean);
DROP FUNCTION IF EXISTS public.get_part_avg_cost(uuid, uuid);
DROP FUNCTION IF EXISTS public.next_inventory_doc_no(inventory_doc_type);
DROP FUNCTION IF EXISTS public.inventory_doc_type_prefix(inventory_doc_type);
DROP FUNCTION IF EXISTS public.post_inventory_doc(uuid);
DROP FUNCTION IF EXISTS public.apply_stock_delta(uuid, uuid, uuid, numeric);
DROP FUNCTION IF EXISTS public.ensure_ticket_is_accepted();
DROP FUNCTION IF EXISTS public.prevent_negative_stock();
DROP FUNCTION IF EXISTS public.validate_inventory_doc_line_qty();
DROP FUNCTION IF EXISTS public.audit_set_defaults();
DROP FUNCTION IF EXISTS public.now_santo_domingo();

-- TYPES
DROP TYPE IF EXISTS public.part_criticality;
DROP TYPE IF EXISTS public.inventory_doc_status;
DROP TYPE IF EXISTS public.inventory_doc_type;
