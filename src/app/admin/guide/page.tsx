"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./admin-guide.module.css";

const checklistItems = [
  ["dashboard", "ดูงานที่ต้องดำเนินการ", "เริ่มจาก Queue ที่ตรงกับสิทธิ์ของคุณ"],
  ["payment", "ตรวจ Payment ที่รอผล", "เปิดดูสลิปก่อนกดยืนยันหรือไม่ผ่าน"],
  ["delay", "ตรวจ Production/QC ที่ค้าง", "ติดตามรายการล่าช้าและรายการที่ต้อง Rework"],
  ["delivery", "ตรวจ Shipment/Delivery", "ดูรายการระหว่างทางและนัดส่ง 7 วันข้างหน้า"],
] as const;

export default function AdminGuidePage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setChecked(JSON.parse(localStorage.getItem("gisp-admin-guide-checklist-v1") ?? "{}"));
    } catch {
      setChecked({});
    }
  }, []);

  function toggle(key: string, value: boolean) {
    const next = { ...checked, [key]: value };
    setChecked(next);
    try { localStorage.setItem("gisp-admin-guide-checklist-v1", JSON.stringify(next)); } catch { /* private mode */ }
  }

  return <div className={styles.guide}>
    <section className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>GISP Operations Manual</p>
        <h1>คู่มือใช้งานสำหรับ Admin</h1>
        <p>ทำงานตามลำดับจริง ตั้งแต่ดู Queue, จัดการ Catalog และราคา ไปจนถึง Finance, Production, QC, Logistics และ Claim</p>
      </div>
      <div className={styles.heroActions}>
        <button type="button" className={styles.button} onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button>
        <Link className={`${styles.button} ${styles.buttonSecondary}`} href="/admin/dashboard">เปิด Dashboard</Link>
      </div>
    </section>

    <div className={styles.layout}>
      <aside className={styles.toc} aria-label="สารบัญคู่มือ Admin">
        <strong>สารบัญ</strong>
        <a href="#daily">เริ่มงานประจำวัน</a>
        <a href="#access">สิทธิ์และความปลอดภัย</a>
        <a href="#reports">Dashboard และรายงาน</a>
        <a href="#catalog">Catalog และราคา</a>
        <a href="#import">Import และ Batch</a>
        <a href="#publish">Review / Publish</a>
        <a href="#rfq">Custom RFQ</a>
        <a href="#quotation">Quotation</a>
        <a href="#order">Order / Payment / PO</a>
        <a href="#production">Production และ QC</a>
        <a href="#logistics">Logistics / Delivery</a>
        <a href="#claim">Claim</a>
        <a href="#showroom">Showroom Visit</a>
        <a href="#accounts">Member / พนักงาน</a>
        <a href="#settings">Settings และ Audit</a>
        <a href="#troubleshoot">แก้ปัญหา</a>
      </aside>

      <main className={styles.content}>
        <details className={`${styles.details} ${styles.mobileToc}`}>
          <summary>เปิดสารบัญ</summary>
          <div className={styles.detailsBody}><div className={styles.linkGrid}><a href="#daily">เริ่มงานประจำวัน</a><a href="#catalog">Catalog</a><a href="#order">Order</a><a href="#troubleshoot">แก้ปัญหา</a></div></div>
        </details>

        <section className={styles.section} id="daily">
          <p className={styles.eyebrow}>Daily opening</p>
          <h2>เริ่มงานประจำวันตามลำดับนี้</h2>
          <p className={styles.muted}>ติ๊กถูกได้เมื่อทำเสร็จ ระบบจะจำไว้ในเบราว์เซอร์เครื่องนี้</p>
          <div className={styles.quickGrid}>
            {checklistItems.map(([key, title, note]) => <label className={styles.check} key={key}><input type="checkbox" checked={Boolean(checked[key])} onChange={(event) => toggle(key, event.target.checked)}/><span><b>{title}</b><small>{note}</small></span></label>)}
          </div>
          <div className={styles.flow}><span>Dashboard</span><i>→</i><span>Queue เร่งด่วน</span><i>→</i><span>ตรวจหลักฐาน</span><i>→</i><span>บันทึกผล</span><i>→</i><span>ตรวจ Timeline</span></div>
          <div className={`${styles.callout} ${styles.safe}`}><strong>หลักปฏิบัติ</strong>เปิดดูข้อมูลต้นทางและหลักฐานก่อนกดยืนยันทุกครั้ง จากนั้นตรวจ Timeline ว่าระบบบันทึกสถานะใหม่แล้ว</div>
        </section>

        <section className={styles.section} id="access">
          <p className={styles.eyebrow}>Access control</p>
          <h2>เมนูขึ้นตามกลุ่มงาน</h2>
          <p>พนักงานแต่ละคนเลือกหนึ่งกลุ่มงานและจะเห็นเฉพาะข้อมูลกับปุ่มที่จำเป็น หากเมนูไม่ปรากฏ ห้ามใช้บัญชีของผู้อื่น ให้เจ้าของระบบตรวจกลุ่มงานแทน</p>
          <table className={styles.roleTable}>
            <thead><tr><th>กลุ่มงาน</th><th>งานที่รับผิดชอบ</th><th>ข้อมูลที่จำกัด</th></tr></thead>
            <tbody>
              <tr><td>ผู้ดูแลระบบงานและออเดอร์</td><td>Member, Catalog, RFQ, Order, จัดซื้อ, Production, QC และ Claim</td><td>สร้างคำขอจ่ายได้ แต่อนุมัติหรือบันทึกจ่ายจริงไม่ได้</td></tr>
              <tr><td>การเงิน</td><td>ตรวจเงินลูกค้า อนุมัติ/บันทึกเงินโรงงาน และค่าขนส่ง</td><td>ไม่มีสิทธิ์แก้ Catalog, QC หรือ Shipment</td></tr>
              <tr><td>โลจิสติกส์</td><td>คลังสินค้า, Shipment, Tracking และ Delivery</td><td>ไม่เห็นต้นทุน กำไร สลิป หรือข้อมูลจ่ายโรงงาน</td></tr>
              <tr><td>เจ้าของระบบ</td><td>สร้างพนักงาน ตั้งค่าระบบ และตรวจ Permission</td><td>ใช้ SUPER_ADMIN เฉพาะงานเจ้าของระบบ</td></tr>
            </tbody>
          </table>
          <div className={`${styles.callout} ${styles.danger}`}><strong>ห้ามแชร์ข้อมูลภายใน</strong>Factory Cost, Supplier Candidate, Supplier Payment, Internal Note และ Security Log ห้ามคัดลอกส่งให้ Member</div>
        </section>

        <section className={styles.section} id="reports">
          <p className={styles.eyebrow}>Dashboard & reporting</p>
          <h2>ภาพรวมงาน รายงาน และสรุปผู้บริหาร</h2>
          <details className={styles.details} open><summary>ภาพรวมงาน</summary><div className={styles.detailsBody}><ol className={styles.steps}><li>เปิด “ภาพรวมงาน” และดูจำนวนงานที่ต้องดำเนินการ</li><li>ตรวจ Payment รอตรวจ, Production ล่าช้า, QC, Shipment, Delivery และ Claim</li><li>กดรายการใน Queue เพื่อเปิดหน้าต้นทาง แล้วดำเนินการตาม Role</li><li>ตรวจเวลาที่ระบบอัปเดตด้านล่าง</li></ol></div></details>
          <details className={styles.details}><summary>Executive Summary</summary><div className={styles.detailsBody}><p>เลือกวันที่เริ่มและสิ้นสุด แล้วกดอัปเดตสรุป เพื่อดูมูลค่า Order, รับชำระ, ลูกหนี้, ยอดค้าง Partner, ค่าขนส่ง และสถานะปฏิบัติการ อ่านอย่างเดียว</p></div></details>
          <details className={styles.details}><summary>Fixed Reports</summary><div className={styles.detailsBody}><p>เลือกประเภทรายงาน ช่วงวันที่ และสถานะ กดใช้ตัวกรอง แล้วเปิดรายการต้นทางหรือ Export CSV ได้ ข้อมูลถูกจำกัดตามสิทธิ์</p></div></details>
        </section>

        <section className={styles.section} id="catalog">
          <p className={styles.eyebrow}>Catalog & pricing</p>
          <h2>สร้าง Supplier, Product และราคา</h2>
          <h3>1. Supplier</h3>
          <ol className={styles.steps}><li>เปิด “Catalog & Pricing” แท็บ 01 Supplier</li><li>กรอกรหัส ชื่อ ประเทศ สกุลเงิน ผู้ติดต่อ และ Lead time</li><li>สร้างเป็น Prospect แล้วตรวจข้อมูลก่อนเปิดใช้เป็น Active</li></ol>
          <h3>2. Product Draft</h3>
          <ol className={styles.steps}><li>เลือก Supplier และกรอก SKU, ชื่อไทย, ประเภท, ประเทศ, หมวด และ Lead time</li><li>กดสร้าง Product Draft แล้วเปิด Product Detail</li><li>กรอกข้อมูลหลักและข้อมูลต้นทาง จากนั้นเพิ่ม Variant/Option</li><li>อัปโหลดรูปสินค้าและตั้งรูปหลัก พร้อมแนบ PDF ที่เกี่ยวข้อง</li></ol>
          <h3>3. Cost & Formula</h3>
          <ol className={styles.steps}><li>เลือกสินค้าและบันทึก Factory Cost พร้อมอัตราแลกเปลี่ยนเป็น THB</li><li>เลือก Formula ที่ Active แล้วกด Preview</li><li>ตรวจ Member Price, Margin, Suggested Resale และ Freight Estimate</li><li>เมื่อถูกต้องจึงกดเปิดใช้ราคาสมาชิก</li></ol>
          <div className={styles.callout}><strong>ราคาของ CN01</strong>ใช้อัตราที่อนุมัติ 1 CNY = 5 THB และ Lead time 60 วัน (ผลิต 30 + ขนส่ง 30) เฉพาะเมื่อข้อมูล Supplier/รอบราคายังใช้อัตรานี้อยู่</div>
        </section>

        <section className={styles.section} id="import">
          <p className={styles.eyebrow}>Bulk operations</p>
          <h2>Import สินค้าและเติมข้อมูลเป็นชุด</h2>
          <h3>Import Excel/CSV</h3>
          <ol className={styles.steps}><li>ดาวน์โหลด Template จากหน้า Import</li><li>กรอกคอลัมน์บังคับ sku, name_th และ product_type</li><li>เลือก Supplier และไฟล์ Excel/CSV ไม่เกิน 10 MB สูงสุด 1,000 แถว</li><li>กดตรวจไฟล์ ดู Preview และดาวน์โหลด Error Report หากมีรายการผิด</li><li>แก้ไฟล์แล้วตรวจใหม่ จนรายการพร้อม</li><li>กดยืนยัน Import รายการที่ผ่านเป็น Draft — ขั้นตอนนี้ยังไม่ Publish</li></ol>
          <h3>Batch Enrichment</h3>
          <ol className={styles.steps}><li>เลือก Supplier และกรองตามข้อมูลที่ขาด</li><li>เลือกเฉพาะสินค้าที่ต้องแก้ แล้วเติม Lead time หรือวัสดุ</li><li>สร้าง Default Variant เฉพาะรายการที่มีมิติครบ</li><li>กรอก Exchange Rate ที่อนุมัติแล้วเพื่อสร้าง Cost Version</li><li>คำนวณและเปิดใช้ Member Price ด้วย Formula Active</li><li>ตรวจประวัติ Batch: สำเร็จ, ข้าม และไม่สำเร็จ</li></ol>
          <div className={`${styles.callout} ${styles.danger}`}><strong>ระบบไม่เดาข้อมูล</strong>อย่าเติมวัสดุหรืออัตราแลกเปลี่ยนแบบเหมารวม ถ้ารายการที่เลือกใช้ข้อมูลต่างกัน ให้แบ่ง Batch</div>
        </section>

        <section className={styles.section} id="publish">
          <p className={styles.eyebrow}>Controlled lifecycle</p>
          <h2>ตรวจ Product ก่อน Publish</h2>
          <ol className={styles.steps}><li>เปิด Product Detail และตรวจแถบความพร้อม: ข้อมูลหลัก, Variant, รูป, ต้นทุนและราคา</li><li>แก้ Blocking Issue ให้หมด แล้วกด “ตรวจอีกครั้ง”</li><li>เมื่อข้อมูลครบ ผู้ดูแล Product กด “ส่งเข้าตรวจ”</li><li>ผู้มีสิทธิ์ Publish ตรวจข้อมูลและเลือก “ผ่าน Review” หรือ “ส่งกลับแก้ไข” พร้อมหมายเหตุ</li><li>เมื่อ Review ผ่านและ Validation ยังครบ จึงกด “Publish Product”</li><li>เปิด Member Catalog ตรวจชื่อ รูป ราคา Option และ Lead time</li></ol>
          <div className={styles.flow}><span>DRAFT</span><i>→</i><span>REVIEW</span><i>→</i><span>PASSED</span><i>→</i><span>PUBLISHED</span></div>
          <div className={styles.callout}><strong>ถอน Publish</strong>กรอกเหตุผลอย่างน้อย 3 ตัวอักษรและยืนยัน สินค้าจะหายจาก Member Catalog แต่ประวัติยังคงอยู่</div>
        </section>

        <section className={styles.section} id="rfq">
          <p className={styles.eyebrow}>Custom RFQ queue</p>
          <h2>ตรวจคำขอสินค้าสั่งทำ</h2>
          <ol className={styles.steps}><li>เปิดคำขอใหม่ ตรวจสเปก ขนาด จำนวน โครงการ และไฟล์อ้างอิง</li><li>บันทึกหมายเหตุภายในหากจำเป็น — Member จะไม่เห็น</li><li>มอบหมายผู้ตรวจและกำหนด Due Date แล้วกดเริ่มตรวจสอบ</li><li>เลือกและบันทึก Supplier Candidate อย่างน้อย 1 ราย</li><li>หากข้อมูลไม่ครบ กดขอข้อมูลเพิ่มและระบุสิ่งที่ต้องการให้ชัด</li><li>เมื่อข้อมูลครบ กด “พร้อมทำใบเสนอราคา”</li></ol>
          <div className={styles.callout}><strong>ยกเลิกคำขอ</strong>ทำได้ก่อน Convert เท่านั้น และต้องบันทึกเหตุผลเพื่อ Audit</div>
        </section>

        <section className={styles.section} id="quotation">
          <p className={styles.eyebrow}>Custom quotation</p>
          <h2>สร้าง Revision และส่งให้ Member</h2>
          <ol className={styles.steps}><li>เลือก RFQ สถานะพร้อมทำใบเสนอราคา</li><li>กรอกราคาก่อน VAT, Lead time, Validity, Supplier Candidate และต้นทุนภายใน</li><li>ตรวจสเปกที่ยืนยันและหมายเหตุ แล้วสร้าง Draft/Revision</li><li>เปิดรายละเอียด ตรวจส่วนที่ Member เห็นและส่วน Internal Only แยกกัน</li><li>ดาวน์โหลด PDF ตรวจครั้งสุดท้าย แล้วกด “ส่งให้สมาชิก”</li><li>ติดตามผล Accepted/Rejected หากหมดอายุให้บันทึกสถานะหมดอายุ</li></ol>
          <div className={`${styles.callout} ${styles.danger}`}><strong>หลังส่งแล้วแก้ไม่ได้</strong>ราคา VAT สเปก และ Lead time ถูกล็อกตาม Revision หากต้องแก้ให้สร้าง Revision ใหม่</div>
        </section>

        <section className={styles.section} id="order">
          <p className={styles.eyebrow}>Order & finance</p>
          <h2>ตรวจ Payment, ออก PO และจ่าย Supplier</h2>
          <ol className={styles.steps}><li>ค้นหา Order ด้วยเลข Order, โครงการ หรือบริษัท แล้วเปิดรายละเอียด</li><li>เปิดสลิปของ Member ตรวจยอด งวด และเวลาโอน</li><li>กด “ยืนยัน” เมื่อยอดตรง หรือ “ไม่ผ่าน” พร้อมเหตุผล</li><li>ออก PO ได้เมื่อมัดจำลูกค้าถูก Finance ตรวจครบพอดี และสถานะเป็น DEPOSIT_VERIFIED</li><li>หลังออก PO จึงสร้างคำขอจ่าย Supplier ตามงวด 50/50</li><li>ผู้มีสิทธิ์ตรวจคำขอจ่าย กดอนุมัติ/ไม่อนุมัติ จากนั้นแนบหลักฐานเมื่อจ่ายจริง</li></ol>
          <div className={`${styles.callout} ${styles.danger}`}><strong>เงินและการยกเลิก</strong>คำขอยกเลิกหลังรับมัดจำต้องบันทึกยอดคืน/ยอดหักและเหตุผล ระบบไม่คืนเงินอัตโนมัติ</div>
        </section>

        <section className={styles.section} id="production">
          <p className={styles.eyebrow}>Production & QC</p>
          <h2>อัปเดตการผลิตและควบคุม Dispatch Gate</h2>
          <h3>Production</h3>
          <ol className={styles.steps}><li>เลือกสถานะจากโรงงาน เช่น เตรียมวัสดุ, กำลังผลิต, ประกอบ, เก็บงาน หรือผลิตเสร็จ</li><li>ตรวจเปอร์เซ็นต์ความคืบหน้า ใส่ ETA และแนบรูป/วิดีโอ/PDF</li><li>หากล่าช้า ต้องระบุเหตุผล แล้วบันทึก</li></ol>
          <h3>QC</h3>
          <ol className={styles.steps}><li>ต้องบันทึกการผลิตเป็น “ผลิตเสร็จ 100%” ก่อนเริ่ม QC</li><li>ตรวจ Checklist ทุกข้อ ใส่หมายเหตุและหลักฐาน</li><li>ระบบสรุปผ่านอัตโนมัติเมื่อทุกข้อผ่าน หากไม่ผ่านให้เลือก Failed/Rework และระบุข้อบกพร่อง</li><li>หลังแก้ไข ให้เริ่มตรวจซ้ำและเก็บผลเป็นรอบใหม่</li><li>สินค้า Custom ต้องรอ Member อนุมัติรายงาน QC ก่อนจัดส่ง</li></ol>
          <div className={styles.callout}><strong>Dispatch Gate</strong>ต้องผ่านเงื่อนไขมัดจำ Supplier, ผลิตครบ, QC ผ่าน และการอนุมัติ Member สำหรับสินค้า Custom จึงจัดส่งได้</div>
        </section>

        <section className={styles.section} id="logistics">
          <p className={styles.eyebrow}>Logistics & delivery</p>
          <h2>จัดส่ง ติดตาม และบันทึก POD</h2>
          <ol className={styles.steps}><li>ตรวจการรวมสินค้าและสร้าง Shipment เมื่อผ่านเงื่อนไข</li><li>ถ้าเป็นการส่งบางส่วน ให้รอ Member รับทราบค่าใช้จ่ายก่อน</li><li>กดยืนยันออกเดินทาง แล้วเพิ่ม Tracking พร้อมสถานที่และข้อความที่ Member เห็นได้</li><li>เมื่อพร้อมส่ง ให้เสนอนัด ระบุผู้ติดต่อ โทรศัพท์ และหมายเหตุหน้างาน</li><li>ตรวจและอนุมัติคำขอเลื่อนนัด หากมี</li><li>เริ่มนำส่ง แล้วบันทึกจำนวนจริง สภาพสินค้า ผู้รับ และแนบ POD</li><li>บันทึกต้นทุนขนส่งจริง → Finance ยืนยัน → ออกใบแจ้งหนี้ค่าขนส่ง</li></ol>
          <div className={`${styles.callout} ${styles.danger}`}><strong>ตรวจค่าตั้งต้นทุกครั้ง</strong>แก้วัน เวลา ผู้ติดต่อ เบอร์รถ เลข Tracking ค่าใช้จ่าย และหมายเหตุให้เป็นข้อมูลจริงก่อนกดบันทึก ห้ามใช้ข้อความ UAT กับงานจริง</div>
        </section>

        <section className={styles.section} id="claim">
          <p className={styles.eyebrow}>After-sales claim</p>
          <h2>ตรวจและปิด Claim อย่างมีหลักฐาน</h2>
          <ol className={styles.steps}><li>เปิด Claim ตรวจ Order, สินค้า, จำนวน, ประเภทปัญหา, Warranty Snapshot และหลักฐาน</li><li>กดเริ่มตรวจสอบ หรือขอข้อมูลเพิ่มจาก Member</li><li>ตรวจคำแนะนำของระบบ แล้วเลือกยืนยันผู้รับผิดชอบ</li><li>กำหนด Resolution เช่น Repair/Replace พร้อมเป้าหมายและรายละเอียด</li><li>กดเริ่มดำเนินการ เมื่อเสร็จให้แนบหลักฐานผลและรอ Member ยืนยัน</li><li>หลัง Member ยืนยันแล้ว Admin จึงกดปิด Claim</li></ol>
          <div className={styles.callout}><strong>ข้อมูลภายใน</strong>บันทึกต้นทุน Claim ได้ในส่วน Internal Confidential และ Member จะไม่เห็น ส่วน Compensation/Credit เป็นข้อเสนอ ไม่จ่ายอัตโนมัติ</div>
        </section>

        <section className={styles.section} id="showroom">
          <p className={styles.eyebrow}>Showroom visit</p>
          <h2>จัดการคำขอเข้าชม Showroom</h2>
          <ol className={styles.steps}><li>กรองสถานะและเปิดคำขอที่รอตรวจ</li><li>กดอนุมัติ พร้อมระบุวัน เวลา สถานที่ และผู้ประสานงาน หรือไม่อนุมัติพร้อมเหตุผล</li><li>หลังเยี่ยมชมจริง กดเสร็จสิ้นและบันทึกหมายเหตุ</li><li>ระบบเปิดเผย Supplier ตามสิทธิ์หลังปิดงาน สามารถถอนสิทธิ์ได้เมื่อมีเหตุผล</li></ol>
        </section>

        <section className={styles.section} id="accounts">
          <p className={styles.eyebrow}>Account governance</p>
          <h2>สมาชิกและบัญชีพนักงาน</h2>
          <details className={styles.details} open><summary>คำขอสมาชิก</summary><div className={styles.detailsBody}><p>ตรวจบริษัทและผู้ติดต่อก่อนอนุมัติ หากปฏิเสธหรือระงับต้องระบุเหตุผล สามารถเปิดใช้อีกครั้ง, Force Logout หรือส่ง Reset Password ได้ ทุก Action มี Audit</p></div></details>
          <details className={styles.details}><summary>ผู้ใช้ภายใน</summary><div className={styles.detailsBody}><p>เฉพาะเจ้าของระบบเปิดหน้า “ผู้ใช้ภายใน” กรอกชื่อ อีเมล รหัสผ่านชั่วคราวอย่างน้อย 10 ตัวอักษร แล้วเลือกหนึ่งในสามกลุ่มงาน แจ้งให้พนักงานเปลี่ยนรหัสหลังเข้าใช้งานครั้งแรก</p></div></details>
          <details className={styles.details}><summary>สิทธิ์เทคนิคเบื้องหลัง</summary><div className={styles.detailsBody}><p>Role เทคนิคยังคงอยู่เพื่อควบคุมสิทธิ์อย่างละเอียด แต่เฉพาะ SUPER_ADMIN เท่านั้นที่เปิดและแก้ Permission Matrix ได้ พนักงานไม่สามารถเพิ่มสิทธิ์ให้ตัวเอง</p></div></details>
          <div className={`${styles.callout} ${styles.danger}`}><strong>Least privilege</strong>ให้สิทธิ์เท่าที่ต้องใช้ในการทำงาน ไม่ใช้ SUPER_ADMIN เป็นบัญชีประจำวัน และห้ามแชร์บัญชีร่วมกัน</div>
        </section>

        <section className={styles.section} id="settings">
          <p className={styles.eyebrow}>System governance</p>
          <h2>Company Settings และ Audit</h2>
          <h3>Company Settings</h3><p>ตรวจชื่อบริษัท ชื่อนิติบุคคล เลขภาษี อีเมล ที่อยู่ VAT สกุลเงิน และเขตเวลา การแก้ไขต้องยืนยันและกระทบเอกสาร/การคำนวณในอนาคต</p>
          <h3>Audit & Security</h3><p>ใช้ตรวจ Action ของผู้ใช้และ Security Event รายการเป็นหลักฐานแบบ Append-only แก้ไขหรือลบย้อนหลังไม่ได้ และไม่เก็บ Password หรือ Token</p>
        </section>

        <section className={styles.section} id="troubleshoot">
          <p className={styles.eyebrow}>Troubleshooting</p>
          <h2>ถ้าทำรายการไม่ได้</h2>
          <ol className={styles.steps}><li>ตรวจ Role/Permission ของบัญชี หากเมนูหรือปุ่มไม่แสดงให้ติดต่อ SUPER_ADMIN</li><li>กดโหลดใหม่และตรวจสถานะล่าสุด เพราะหลาย Action ทำได้ตามลำดับเท่านั้น</li><li>อ่านข้อความ Blocking Issue หรือ Gate แล้วกลับไปทำขั้นตอนที่ขาด</li><li>เปิดหลักฐาน ตรวจชนิด/ขนาดไฟล์ และลองอัปโหลดใหม่</li><li>เตรียมเลขอ้างอิง, ภาพหน้าจอ, เวลาเกิดเหตุ และข้อความ Error ก่อนแจ้งทีมเทคนิค</li></ol>
          <div className={styles.linkGrid}>
            <Link href="/admin/dashboard">ภาพรวมงาน</Link><Link href="/admin/catalog">Catalog & Pricing</Link><Link href="/admin/orders">Order & Payment</Link><Link href="/admin/claims">Claim Queue</Link><Link href="/admin/logs">Audit & Security</Link><Link href="/member-guide.html" target="_blank">คู่มือ Member</Link>
          </div>
        </section>

        <p className={styles.footer}>คู่มือ GISP Admin · อัปเดต 6 กันยายน 2569 · การมองเห็นเมนูขึ้นอยู่กับกลุ่มงานและ Permission</p>
      </main>
    </div>
  </div>;
}
