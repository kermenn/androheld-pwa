/* ==========================================================================
   Supabase Data Service (Direct REST API mirroring SupabaseRepository.kt)
   ========================================================================== */

import { CONFIG } from '../config.js';

export const SupabaseService = {
  async fetchKpiSummary() {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/androheld_kpi?select=*&limit=1`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': CONFIG.SUPABASE_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: Gagal memuat KPI Cloud`);
    }

    const data = await res.json();
    if (!data || data.length === 0) {
      throw new Error("Data KPI belum tersedia di cloud.");
    }

    const obj = data[0];
    return {
      healthPercent: obj.health_percent ?? obj.healthiness_percent ?? 37.1,
      healthValueUsd: obj.health_value_usd ?? 1371550.33,
      excessPercent: obj.excess_percent ?? 46.8,
      excessValueUsd: obj.excess_value_usd ?? 1731177.68,
      deadstockPercent: obj.deadstock_percent ?? 8.8,
      deadstockValueUsd: obj.deadstock_value_usd ?? 326816.13,
      obsoletePercent: obj.obsolete_percent ?? 7.3,
      obsoleteValueUsd: obj.obsolete_value_usd ?? 270352.17,
      totalPostureValueUsd: obj.total_posture_value_usd ?? 3699896.30,

      woAllReadinessPercent: obj.wo_all_readiness_percent ?? obj.wo_readiness_percent ?? 72.0,
      woAllReadyCount: obj.wo_all_ready_count ?? 1329,
      woAllTotalCount: obj.wo_all_total_count ?? 1847,

      woMpReadinessPercent: obj.wo_mp_readiness_percent ?? 86.7,
      woMpReadyCount: obj.wo_mp_ready_count ?? 806,
      woMpTotalCount: obj.wo_mp_total_count ?? 930,

      lastSyncTime: obj.last_sync_time || "Baru saja"
    };
  },

  async searchItems(query, limit = 30) {
    const cleanQuery = query.trim().toUpperCase();
    if (!cleanQuery) return [];

    const normalized = cleanQuery.replace(/-/g, '').replace(/:/g, '');
    const filter = `or=(base_pn.ilike.*${normalized}*,base_pn.ilike.*${cleanQuery}*,part_number.ilike.*${cleanQuery}*,description.ilike.*${cleanQuery}*)&limit=${limit}`;
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/androheld_items?${encodeURI(filter)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': CONFIG.SUPABASE_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }

    const items = await res.json();
    return items.map(this.parseItem);
  },

  async fetchAllItems(pageSize = 1000) {
    let all = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const url = `${CONFIG.SUPABASE_URL}/rest/v1/androheld_items?select=*&order=part_number.asc&limit=${pageSize}&offset=${offset}`;
      const res = await fetch(url, {
        headers: {
          'apikey': CONFIG.SUPABASE_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`
        }
      });
      if (!res.ok) break;

      const chunk = await res.json();
      if (!chunk || chunk.length === 0) break;

      all.push(...chunk.map(this.parseItem));
      if (chunk.length < pageSize) {
        hasMore = false;
      } else {
        offset += chunk.length;
      }
    }
    return all;
  },

  parseItem(obj) {
    let woAllocations = [];
    if (obj.wo_allocations_json) {
      try {
        woAllocations = typeof obj.wo_allocations_json === 'string' 
          ? JSON.parse(obj.wo_allocations_json) 
          : obj.wo_allocations_json;
      } catch (e) {}
    }

    return {
      partNumber: obj.part_number || "",
      basePn: obj.base_pn || "",
      description: obj.description || "",
      plant: obj.plant || "1346",
      sloc: obj.sloc || "DMDV",
      uom: obj.uom || "PC",
      valType: obj.val_type || "CATNEW",
      stockAtp: parseFloat(obj.stock_atp || 0),
      minStock: parseFloat(obj.min_stock || 0),
      maxStock: parseFloat(obj.max_stock || 0),
      stockStatus: obj.stock_status || "SAFE",
      postureCategory: obj.posture_category || "HEALTH STOCK",
      hasWoAllocation: Boolean(obj.has_wo_allocation),
      woAllocations: woAllocations,
      woReqQty: parseFloat(obj.wo_req_qty || 0),
      inTransitStoQty: parseFloat(obj.in_transit_sto_qty || 0),
      onOrderQty: parseFloat(obj.on_order_qty || 0),
      woReadinessStatus: obj.wo_readiness_status || "NO ALLOCATION",
      woReadinessNote: obj.wo_readiness_note || "",
      isMonthlyPlan: Boolean(obj.is_monthly_plan),
      woReqQtyMp: parseFloat(obj.wo_req_qty_mp || 0),
      woReadinessStatusMp: obj.wo_readiness_status_mp || "NO MP ALLOCATION",
      woReadinessNoteMp: obj.wo_readiness_note_mp || "",
      hsCode: obj.hs_code || "",
      kuotaImportStatus: obj.kuota_import_status || "Available"
    };
  }
};
