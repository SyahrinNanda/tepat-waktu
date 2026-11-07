-- Fitur IP Whitelist dihapus permanen (keputusan 6 Nov 2026). Datanya disimpan di feature_records.
DELETE FROM "feature_records" WHERE "module" = 'pengaturan/ip-whitelist';
