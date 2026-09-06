import { MemberPortal } from "@/components/demo-v14/member-portal";
import { V14Provider } from "@/components/demo-v14/v14-context";

export default async function MemberPage({searchParams}:{searchParams:Promise<{screen?:string}>}){const{screen}=await searchParams;return <V14Provider><MemberPortal initialScreen={screen}/></V14Provider>}
