import JSZip from 'jszip';
import {readFile} from 'node:fs/promises';
for(const kind of ['forest_rescue']){
 const zip=await JSZip.loadAsync(await readFile(`server/templates/${kind}.pptx`));
 for(const number of [2,3,4,5,6,7]){
  const file=zip.file(`ppt/slides/slide${number}.xml`);if(!file)continue;const xml=await file.async('string');
  console.log(kind,number);
  for(const match of xml.matchAll(/<p:(sp|pic)>[\s\S]*?<\/p:\1>/g)){
   const shape=match[0],id=shape.match(/<p:cNvPr\b[^>]*id="(\d+)"/)?.[1],text=[...shape.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m=>m[1]).join('');
   console.log(JSON.stringify({id,text,link:shape.match(/<a:hlinkClick[^>]+/)?.[0],img:shape.match(/<a:blip\b[^>]+/)?.[0],geometry:shape.match(/<a:xfrm[\s\S]*?<\/a:xfrm>/)?.[0]}));
  }
 }
}
