import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";

export function xmlEscape(value:unknown){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
export function buildExcelXml(title:string,rows:Array<Array<string|number>>){const cells=(row:Array<string|number>)=>row.map(value=>`<Cell><Data ss:Type="${typeof value==="number"?"Number":"String"}">${xmlEscape(value)}</Data></Cell>`).join("");return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Product Schedule"><Table><Row><Cell><Data ss:Type="String">${xmlEscape(title)}</Data></Cell></Row>${rows.map(row=>`<Row>${cells(row)}</Row>`).join("")}</Table></Worksheet></Workbook>`}

function wrapText(text:string,font:{widthOfTextAtSize:(value:string,size:number)=>number},size:number,maxWidth:number){const words=text.split(/\s+/);const lines:string[]=[];let current="";for(const word of words){const next=current?`${current} ${word}`:word;if(font.widthOfTextAtSize(next,size)<=maxWidth){current=next}else{if(current)lines.push(current);current=word}}if(current)lines.push(current);return lines}

export async function buildSimplePdf(lines:string[]){const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const fontBytes=await readFile(path.join(process.cwd(),"public","fonts","NotoSansThaiLooped.ttf"));const font=await pdf.embedFont(fontBytes,{subset:true});let page=pdf.addPage([595.28,841.89]);const margin=40,size=10,lineHeight=17,maxWidth=page.getWidth()-margin*2;let y=page.getHeight()-margin;for(const source of lines){const wrapped=source?wrapText(source,font,size,maxWidth):[""];for(const line of wrapped){if(y<margin+lineHeight){page=pdf.addPage([595.28,841.89]);y=page.getHeight()-margin}page.drawText(line,{x:margin,y,size,font,color:rgb(0.08,0.08,0.08)});y-=lineHeight}}return pdf.save()}

export async function buildProductSchedulePdf(
  headerLines:string[],
  items:Array<{imageUrl:string|null;lines:string[]}>,
  footerLines:string[],
){
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
  const fontBytes=await readFile(path.join(process.cwd(),"public","fonts","NotoSansThaiLooped.ttf"));
  const font=await pdf.embedFont(fontBytes,{subset:true});
  const loadedImages=await Promise.all(items.map(async item=>{
    if(!item.imageUrl)return null;
    try{const response=await fetch(item.imageUrl);if(!response.ok)return null;const bytes=await response.arrayBuffer();const type=response.headers.get("content-type")??"";if(type.includes("png"))return pdf.embedPng(bytes);if(type.includes("jpeg")||type.includes("jpg"))return pdf.embedJpg(bytes);return null}catch{return null}
  }));
  const margin=40,size=9,lineHeight=15,pageWidth=595.28,pageHeight=841.89;
  let page=pdf.addPage([pageWidth,pageHeight]);let y=pageHeight-margin;
  const drawLines=(lines:string[],x:number,maxWidth:number)=>{for(const source of lines){for(const line of source?wrapText(source,font,size,maxWidth):[""]){page.drawText(line,{x,y,size,font,color:rgb(0.08,0.08,0.08)});y-=lineHeight}}};
  drawLines(headerLines,margin,pageWidth-margin*2);y-=8;
  for(let index=0;index<items.length;index+=1){const item=items[index];const image=loadedImages[index];const blockHeight=Math.max(image?90:0,item.lines.reduce((count,line)=>count+Math.max(1,wrapText(line,font,size,image?pageWidth-margin*2-105:pageWidth-margin*2).length),0)*lineHeight)+12;
    if(y-blockHeight<margin){page=pdf.addPage([pageWidth,pageHeight]);y=pageHeight-margin;}
    const top=y;if(image){const scale=Math.min(90/image.width,90/image.height);page.drawImage(image,{x:margin,y:top-image.height*scale,width:image.width*scale,height:image.height*scale});}
    const textX=image?margin+105:margin;drawLines(item.lines,textX,pageWidth-margin-textX);y=Math.min(y,top-blockHeight);page.drawLine({start:{x:margin,y:y+5},end:{x:pageWidth-margin,y:y+5},thickness:0.5,color:rgb(0.8,0.8,0.8)});
  }
  if(y-footerLines.length*lineHeight<margin){page=pdf.addPage([pageWidth,pageHeight]);y=pageHeight-margin;}y-=8;drawLines(footerLines,margin,pageWidth-margin*2);
  return pdf.save();
}
