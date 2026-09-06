import { CompanySettingsForm } from "@/components/company-settings-form";
import { requireAppAccess } from "@/lib/auth/session";
export default async function SettingsPage(){const context=await requireAppAccess({permissions:["settings.read"]});return <><section className="v14-hero"><div><p className="v14-eyebrow">System foundation</p><h1>Company Settings</h1><p>ชื่อบริษัท เลขภาษี ที่อยู่ อีเมล VAT สกุลเงิน และเขตเวลา</p></div></section><CompanySettingsForm canManage={context.permissions.includes("settings.manage")}/></>}

