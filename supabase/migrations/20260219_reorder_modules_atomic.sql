-- =============================================================================
-- Atomic module reorder function
--
-- Replaces sequential per-row UPDATE with a single transactional batch.
-- Called via supabase.rpc('reorder_view_modules', { ... })
-- =============================================================================

CREATE OR REPLACE FUNCTION reorder_view_modules(
  p_view_id UUID,
  p_order JSONB  -- array of { "module_id": uuid, "sort_order": int }
)
RETURNS VOID
  LANGUAGE plpgsql
  SECURITY INVOKER
AS $$
DECLARE
  v_item JSONB;
  v_module_id UUID;
  v_sort_order INT;
  v_count INT;
BEGIN
  -- Validate all module_ids belong to this view
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order)
  LOOP
    v_module_id := (v_item->>'module_id')::UUID;

    SELECT COUNT(*) INTO v_count
    FROM view_profile_modules
    WHERE view_id = p_view_id AND module_id = v_module_id;

    IF v_count = 0 THEN
      RAISE EXCEPTION 'Module % is not assigned to view %', v_module_id, p_view_id;
    END IF;
  END LOOP;

  -- Apply all updates atomically (single transaction)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order)
  LOOP
    v_module_id := (v_item->>'module_id')::UUID;
    v_sort_order := (v_item->>'sort_order')::INT;

    UPDATE view_profile_modules
    SET sort_order = v_sort_order
    WHERE view_id = p_view_id AND module_id = v_module_id;
  END LOOP;
END;
$$;

-- Lock down execution — service_role only
REVOKE ALL ON FUNCTION reorder_view_modules(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reorder_view_modules(UUID, JSONB) TO service_role;

COMMENT ON FUNCTION reorder_view_modules IS 'Atomically reorder module assignments for a view. Validates all module_ids belong to the view, then applies sort_order updates in a single transaction. Raises exception on invalid module_id.';
