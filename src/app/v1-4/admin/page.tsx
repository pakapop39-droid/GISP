import { AdminPortal } from "@/components/demo-v14/admin-portal";
import { V14Provider } from "@/components/demo-v14/v14-context";

export default async function AdminPage({searchParams}:{searchParams:Promise<{screen?:string}>}){const{screen}=await searchParams;return <V14Provider><AdminPortal initialScreen={screen}/></V14Provider>}
