import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Check, MoveRight } from "lucide-react";
import styles from "./sale-landing.module.css";

export function SaleLanding({ preview = false }: { preview?: boolean }) {
  const demoUrl = "https://gisp-mvp-demo.insforge.site/v1-4/overview";
  return (
    <main className={styles.page} id="top">
      <header className={styles.nav}>
        <a href="#top" className={styles.brand} aria-label="GISP หน้าหลัก">GISP<span>GLOBAL INTERIOR SUPPLY PLATFORM</span></a>
        <nav aria-label="เมนูหลัก"><a href="#approach">GISP ช่วยอย่างไร</a><a href="#journey">ขั้นตอนการทำงาน</a><a href="#faq">คำถามที่พบบ่อย</a></nav>
        <Link className={styles.navCta} href="/login">เข้าสู่ระบบ <ArrowUpRight size={16}/></Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>SOURCED WITH CARE. MANAGED WITH GISP.</p>
          <h1>ซื้อสินค้าจากจีน<br/>มีทีมดูแล<br/><em>มีระบบรองรับ</em></h1>
          <p className={styles.intro}>เฟอร์นิเจอร์และวัสดุตกแต่งจากโรงงานที่เราคัดเลือก พร้อมทีมประสานตรวจคุณภาพ ติดตามจัดส่ง และจัดรายการสินค้าให้ตรงกับโครงการของคุณ</p>
          <Link className={styles.button} href={demoUrl}>ลองดูการซื้อสินค้าผ่าน GISP <ArrowUpRight size={20}/></Link>
          <p className={styles.heroNote}>คัดเลือกแหล่งสินค้า · ตรวจ QC · ติดตามจนส่งมอบ</p>
          <a className={styles.scrollLink} href="#approach"><ArrowDown size={16}/> ดูสิ่งที่เราช่วยดูแลให้คุณ</a>
        </div>
        <figure className={styles.heroImage}>
          <Image src="/demo-assets/riverstone-lobby.png" alt="ภาพตัวอย่างพื้นที่ตกแต่งภายใน พร้อมเฟอร์นิเจอร์ไม้และวัสดุโทนธรรมชาติ" fill priority sizes="(max-width: 800px) 100vw, 54vw"/>
          <div className={styles.imageLabel}><span>SELECTED FOR YOUR PROJECT</span><p>สินค้าที่ใช่สำหรับพื้นที่ของคุณ<br/>พร้อมคนดูแลเบื้องหลัง</p></div>
          <figcaption>ภาพประกอบแนวคิดการตกแต่ง</figcaption>
        </figure>
      </section>

      <div className={styles.ribbon}><span>ดูแลการซื้อของคุณอย่างเป็นขั้นตอน</span><p>คัดเลือกโรงงาน <i/> จัดสินค้าตามโครงการ <i/> ตรวจ QC <i/> ติดตามจัดส่ง</p></div>

      <section className={styles.section} id="problems">
        <div className={styles.sectionHead}><p className={styles.eyebrow}>01 — BUYING FROM CHINA</p><h2>อยากซื้อของจากจีน<br/><span>แต่ยังไม่มั่นใจเรื่องเหล่านี้?</span></h2></div>
        <div className={styles.problems}>
          {[
            ["01", "จะเลือกโรงงานไหน?", "มีสินค้าให้เลือกมาก แต่ไม่รู้ว่าซัพพลายเออร์รายไหนเหมาะกับงาน คุณภาพและเงื่อนไขเป็นอย่างไร"],
            ["02", "ของจริงจะตรงกับที่สั่งไหม?", "สี วัสดุ ขนาด และรายละเอียดต้องตรงตามที่ตกลง หากไม่มีคนตรวจให้ก่อนส่ง ก็อาจเจอปัญหาเมื่อของมาถึง"],
            ["03", "สั่งแล้ว ใครช่วยดูแลต่อ?", "เมื่อซื้อหลายรายการจากหลายแหล่ง คุณต้องรู้ว่าของแต่ละชิ้นอยู่ขั้นตอนไหน และเป็นของโครงการใด"],
          ].map(([number, title, text]) => <article key={number}><span className={styles.number}>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section className={styles.approach} id="approach">
        <div className={styles.approachCopy}><p className={styles.eyebrow}>02 — PEOPLE + PLATFORM</p><h2>คุณเลือกสิ่งที่ต้องการ<br/><em>เราช่วยดูแล<br/>การจัดซื้อให้</em></h2><p>GISP เชื่อมการคัดเลือกสินค้า ทีมจัดซื้อ การตรวจคุณภาพ และการขนส่งเข้ากับระบบเดียว ให้คุณซื้อจากจีนได้อย่างมีข้อมูลและมีคนประสานงาน</p><a href="#journey" className={styles.textLink}>ดูขั้นตอนที่เราดูแล <MoveRight size={20}/></a></div>
        <div className={styles.comparison}>
          <div className={styles.comparisonHead}><span>สิ่งที่เราดูแล</span><span>ประโยชน์ที่คุณได้รับ</span></div>
          {[
            ["คัดเลือกโรงงานและซัพพลายเออร์", "มีทีมตรวจสอบเงื่อนไขและเตรียมข้อมูลสินค้าให้คุณใช้ตัดสินใจ"],
            ["ยืนยันรายละเอียดก่อนสั่งซื้อ", "มีสเปก วัสดุ ขนาด และราคาให้อ้างอิงร่วมกัน ลดความคลาดเคลื่อน"],
            ["ประสานทีมตรวจคุณภาพ (QC)", "ตรวจตามรายละเอียดที่ตกลงก่อนจัดส่ง ช่วยพบข้อผิดพลาดตั้งแต่ต้นทาง"],
            ["ติดตามการผลิตและจัดส่ง", "เปิดดูความคืบหน้าและเอกสารของสินค้าได้จากระบบ"],
            ["จัดรายการสินค้าแยกตามโครงการ", "เลือกของให้แต่ละงาน บันทึกสเปกและจำนวน แล้วกลับมาเรียกดูได้เมื่อต้องการ"],
          ].map(([before, after]) => <div className={styles.comparisonRow} key={before}><p>{before}</p><p><Check size={18}/>{after}</p></div>)}
          <p className={styles.finePrint}>การตรวจคุณภาพอ้างอิงสเปกที่ยืนยันและเงื่อนไขของแต่ละรายการ พร้อมเอกสาร QC ให้ตรวจสอบ</p>
        </div>
      </section>

      <section className={styles.section} id="journey">
        <div className={styles.sectionHead}><p className={styles.eyebrow}>03 — YOUR PURCHASE, STEP BY STEP</p><h2>ตั้งแต่เลือกสินค้า<br/><span>จนถึงรับของ มีขั้นตอนรองรับ</span></h2></div>
        <div className={styles.steps}>{[
          ["01", "เลือกของเข้าโครงการ", "เลือกเฟอร์นิเจอร์และวัสดุจากแหล่งที่ GISP คัดเลือก จัดรายการตามงาน หรือส่งแบบเพื่อขอราคาสั่งผลิต"],
          ["02", "ยืนยันสิ่งที่จะได้รับ", "ตรวจสเปก จำนวน ราคา และเงื่อนไขให้ชัดเจนก่อนสั่งซื้อ ทีมจัดซื้อประสานงานกับซัพพลายเออร์"],
          ["03", "ตรวจคุณภาพก่อนส่ง", "มีทีมประสาน QC และบันทึกผลตรวจเทียบกับรายละเอียดที่ยืนยัน ช่วยลดความผิดพลาดก่อนสินค้าออกจากโรงงาน"],
          ["04", "ติดตามจนรับสินค้า", "ดูสถานะการจัดส่งและหลักฐานส่งมอบในระบบ หากพบปัญหา สามารถแจ้งเคลมพร้อมเอกสารอ้างอิง"],
        ].map(([n, title, text]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        <div className={styles.demoStrip}><div><p className={styles.eyebrow}>SEE IT IN ACTION</p><h3>เห็นภาพการซื้อ ก่อนเริ่มโครงการจริง</h3><p>ลองดูการเลือกสินค้า เอกสาร QC และการติดตามจัดส่งด้วยข้อมูลสาธิต</p></div><Link className={styles.button} href={demoUrl}>เปิดตัวอย่าง GISP <ArrowUpRight size={20}/></Link></div>
      </section>

      <section className={styles.projectSection} id="projects">
        <figure className={styles.projectImage}><Image src="/demo-assets/riverstone-product-board.png" alt="ภาพประกอบชุดเฟอร์นิเจอร์และวัสดุสำหรับจัดรายการสินค้าในโครงการ" fill sizes="(max-width: 800px) 100vw, 46vw"/><figcaption>ภาพประกอบการเลือกสินค้าเข้าชุดสำหรับโครงการ</figcaption></figure>
        <div><p className={styles.eyebrow}>04 — A PLACE FOR EVERY PROJECT</p><h2>ซื้อหลายชิ้น หลายงาน<br/><em>ก็จัดเป็นโครงการได้</em></h2><p>ไม่ว่าจะเป็นเฟอร์นิเจอร์สำหรับบ้าน วัสดุตกแต่งร้าน หรือสินค้าสำหรับงานลูกค้า รวมรายการที่ต้องการไว้ด้วยกัน เพื่อกลับมาเลือก ตรวจสอบ และสั่งซื้อได้ตามงาน</p><ul><li><Check size={18}/> แยกรายการสินค้าให้แต่ละโครงการชัดเจน</li><li><Check size={18}/> เก็บสเปก ตัวเลือก และจำนวนที่ต้องการ</li><li><Check size={18}/> เรียกดูรายการและติดตามงานต่อในโครงการเดิม</li></ul><Link className={styles.textLink} href={demoUrl}>ดูตัวอย่างการจัดสินค้าตามโครงการ <MoveRight size={20}/></Link></div>
      </section>

      <section className={styles.faq} id="faq"><div><p className={styles.eyebrow}>BEFORE WE BEGIN</p><h2>เรื่องที่คุณ<br/>อาจอยากรู้ก่อน</h2></div><div>{[
        ["GISP เหมาะกับใคร?", "เหมาะกับนักออกแบบ ผู้รับเหมา ตัวแทนจำหน่าย และผู้เรียนหลักสูตรที่ต้องการจัดซื้อเฟอร์นิเจอร์และวัสดุตกแต่งจากจีน โดยการใช้งานจริงต้องผ่านการอนุมัติสมาชิก"],
        ["GISP ช่วยเลือกโรงงานและซัพพลายเออร์อย่างไร?", "ทีม GISP เป็นผู้คัดเลือกโรงงานและซัพพลายเออร์ เจรจาราคา ตรวจสอบเงื่อนไข และจัดเตรียมข้อมูลสินค้าก่อนนำเข้าสู่ระบบ เพื่อให้สมาชิกมีข้อมูลประกอบการเลือกซื้อ"],
        ["มีคนตรวจคุณภาพสินค้าให้หรือไม่?", "มีทีมประสานการตรวจคุณภาพ (QC) พร้อมรายงานให้อ้างอิง การตรวจยึดสเปกและรายละเอียดที่ยืนยันของแต่ละรายการ และต้องผ่านขั้นตอน QC ก่อนอนุญาตให้ออกจากโรงงาน เพื่อช่วยลดความผิดพลาดก่อนจัดส่ง"],
        ["ติดตามของและแยกสินค้าตามโครงการได้ไหม?", "สามารถจัดรายการสินค้าแยกตามโครงการ และติดตามสถานะการผลิต การจัดส่ง รวมถึงเอกสารที่เกี่ยวข้องผ่านระบบ ทำให้กลับมาเรียกดูงานแต่ละโครงการได้"],
        ["มีแบบอยู่แล้ว ขอราคาสั่งผลิตได้ไหม?", "สามารถส่งรายละเอียดงานสั่งผลิตเพื่อขอราคา โดยสเปก ราคา และระยะเวลาจะยืนยันตามใบเสนอราคาของแต่ละงาน"],
        ["ราคาสินค้ารวมค่าขนส่งหรือยัง?", "ราคาสมาชิกเป็นราคาก่อน VAT ค่าขนส่งประมาณการแสดงแยก และมีเอกสารค่าขนส่งจริงตามรายการ ควรตรวจรายละเอียดก่อนยืนยันทุกครั้ง"],
        ["ยังไม่ได้เป็นสมาชิก ดูระบบก่อนได้ไหม?", "ดูตัวอย่างระบบได้จากปุ่มชมตัวอย่าง โดยใช้ข้อมูลสาธิตเพื่อทำความเข้าใจขั้นตอนก่อนเริ่มใช้งานจริง"],
      ].map(([q,a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>

      <section className={styles.closing}><p className={styles.eyebrow}>YOUR PROJECT. OUR SUPPORT.</p><h2>ซื้อจากจีนครั้งต่อไป<br/>ให้มีทีมและระบบช่วยดูแล</h2><p>ตั้งแต่คัดเลือกแหล่งสินค้า ตรวจคุณภาพ ไปจนถึงติดตามการส่งมอบ</p><Link className={styles.button} href={demoUrl}>ลองดูการซื้อสินค้าผ่าน GISP <ArrowUpRight size={20}/></Link></section>
      <footer className={styles.footer}><a className={styles.brand} href="#top">GISP<span>GLOBAL INTERIOR SUPPLY PLATFORM</span></a><p>{preview ? "ตัวอย่าง Sale Page · ภาพและข้อมูลเพื่อการสาธิต" : "จัดซื้อเฟอร์นิเจอร์และวัสดุตกแต่งจากจีนอย่างเป็นระบบ"}</p><a href="#top">กลับด้านบน ↑</a></footer>
    </main>
  );
}
