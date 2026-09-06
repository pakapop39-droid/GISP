-- Slice 6 Development/UAT fixture only. Do not apply to Production.
DO $$
DECLARE
  admin_id UUID;
  supplier_record UUID;
  category_record UUID;
  product_record RECORD;
BEGIN
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = 'uat-admin-all@gisp.example.com';

  SELECT id INTO supplier_record
  FROM public.suppliers
  WHERE status = 'ACTIVE'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO category_record
  FROM public.categories
  WHERE status = 'ACTIVE'
  ORDER BY created_at
  LIMIT 1;

  IF admin_id IS NULL OR supplier_record IS NULL OR category_record IS NULL THEN
    RAISE EXCEPTION 'Slice 6 UAT prerequisites are incomplete';
  END IF;

  -- Repair products created by the automated Slice 6 test so they are valid
  -- member-catalog fixtures as well as order fixtures.
  UPDATE public.products
  SET qa_status = 'PASSED', reviewed_by = admin_id, reviewed_at = NOW(),
      country_code = 'CN', width_mm = COALESCE(width_mm, 620),
      depth_mm = COALESCE(depth_mm, 680), height_mm = COALESCE(height_mm, 780),
      weight_kg = COALESCE(weight_kg, 18), cbm = COALESCE(cbm, 0.329),
      material_summary = COALESCE(material_summary, 'ไม้โอ๊กและผ้าบุ'),
      finish_summary = COALESCE(finish_summary, 'สีธรรมชาติและผ้าสีครีม'),
      moq = COALESCE(moq, 1), status = 'PUBLISHED',
      published_at = COALESCE(published_at, NOW())
  WHERE sku LIKE 'S6-UAT-%';

  INSERT INTO public.products (
    supplier_id, category_id, sku, product_type, name_th, name_en,
    description_th, specification_summary, default_lead_time_days,
    factory_cost, factory_currency, country_code, width_mm, depth_mm,
    height_mm, weight_kg, cbm, material_summary, finish_summary, moq,
    status, qa_status, reviewed_by, reviewed_at, published_at, created_by
  ) VALUES
    (supplier_record, category_record, 'S6-UAT-CHAIR', 'STANDARD',
     'เก้าอี้เลานจ์ไม้โอ๊ก', 'Oak Lounge Chair',
     'เก้าอี้เลานจ์สำหรับงานพักอาศัยและพื้นที่รับรอง',
     'โครงไม้โอ๊ก เบาะโฟมความหนาแน่นสูง บุผ้าสีครีม', 45,
     25000, 'CNY', 'CN', 620, 680, 780, 18, 0.329,
     'ไม้โอ๊กและผ้าบุ', 'สีธรรมชาติและผ้าสีครีม', 1,
     'PUBLISHED', 'PASSED', admin_id, NOW(), NOW(), admin_id),
    (supplier_record, category_record, 'S6-UAT-TABLE', 'STANDARD',
     'โต๊ะข้างหินธรรมชาติ', 'Natural Stone Side Table',
     'โต๊ะข้างทรงกลมสำหรับห้องนั่งเล่นและพื้นที่รับรอง',
     'ท็อปหินธรรมชาติ ฐานโลหะพ่นสี', 35,
     14000, 'CNY', 'CN', 500, 500, 520, 22, 0.130,
     'หินธรรมชาติและโลหะ', 'หินสีอ่อนและฐานสีบรอนซ์', 1,
     'PUBLISHED', 'PASSED', admin_id, NOW(), NOW(), admin_id),
    (supplier_record, category_record, 'S6-UAT-SOFA', 'STANDARD',
     'โซฟาโมดูลาร์สามที่นั่ง', 'Three-seat Modular Sofa',
     'โซฟาโมดูลาร์สำหรับห้องนั่งเล่นและล็อบบี้',
     'โครงไม้เนื้อแข็ง เบาะโฟมหลายชั้น บุผ้าทอ', 60,
     68000, 'CNY', 'CN', 2400, 980, 760, 92, 1.788,
     'ไม้เนื้อแข็ง โฟม และผ้าทอ', 'ผ้าสีเทาอ่อน', 1,
     'PUBLISHED', 'PASSED', admin_id, NOW(), NOW(), admin_id),
    (supplier_record, category_record, 'S6-UAT-LAMP', 'STANDARD',
     'โคมไฟแขวนทรงกระบอก', 'Cylinder Pendant Lamp',
     'โคมไฟแขวนสำหรับเคาน์เตอร์ ห้องอาหาร และพื้นที่รับรอง',
     'ตัวโคมอะลูมิเนียม แหล่งกำเนิดแสง LED', 30,
     6500, 'CNY', 'CN', 180, 180, 480, 4.5, 0.016,
     'อะลูมิเนียมและอะคริลิก', 'สีบรอนซ์รมดำ', 2,
     'PUBLISHED', 'PASSED', admin_id, NOW(), NOW(), admin_id)
  ON CONFLICT (sku) DO UPDATE SET
    status = 'PUBLISHED', qa_status = 'PASSED', reviewed_by = admin_id,
    reviewed_at = NOW(), published_at = COALESCE(public.products.published_at, NOW());

  FOR product_record IN
    SELECT id, sku
    FROM public.products
    WHERE sku LIKE 'S6-UAT-%'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.product_prices
      WHERE product_id = product_record.id AND variant_id IS NULL
        AND status = 'ACTIVE' AND valid_from <= NOW()
        AND (valid_until IS NULL OR valid_until > NOW())
    ) THEN
      INSERT INTO public.product_prices (
        product_id, price_type, amount, suggested_resale_amount,
        freight_estimate_min, freight_estimate_max, currency,
        valid_from, status, created_by
      ) VALUES (
        product_record.id, 'MEMBER',
        CASE product_record.sku
          WHEN 'S6-UAT-TABLE' THEN 32500
          WHEN 'S6-UAT-SOFA' THEN 168000
          WHEN 'S6-UAT-LAMP' THEN 18500
          ELSE 60000
        END,
        CASE product_record.sku
          WHEN 'S6-UAT-TABLE' THEN 39000
          WHEN 'S6-UAT-SOFA' THEN 201600
          WHEN 'S6-UAT-LAMP' THEN 22200
          ELSE 72000
        END,
        2500, 6500, 'THB', NOW(), 'ACTIVE', admin_id
      );
    END IF;
  END LOOP;
END;
$$;
