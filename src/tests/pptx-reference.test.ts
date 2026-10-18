import { it, expect } from 'vitest';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import { createStudioGame, type TemplateType } from '../domain/studio-spec';
import { renderPptx } from '../../server/pptx';
it.each(['clever_frog','boat_rescue','football','forest_rescue'] as TemplateType[])('%s preserves original motion and media instead of generic reconstruction',async kind=>{
 const spec=createStudioGame(kind);if(!('questions' in spec.content))throw Error();
 spec.content.questions.forEach(q=>{q.prompt='Câu hỏi mới & nội dung';q.choices=['Một','Hai','Ba','Bốn'];q.correct=2;});
 const original=await JSZip.loadAsync(await readFile(`server/templates/${kind}.pptx`));
 const exported=await JSZip.loadAsync(await renderPptx(spec,new Map()));
 const base=kind==='boat_rescue'||kind==='forest_rescue'?4:kind==='football'?2:3;
 const target=kind==='football'?2:3;
 const source=await original.file(`ppt/slides/slide${base}.xml`)!.async('string');
 const result=await exported.file(`ppt/slides/slide${target}.xml`)!.async('string');
 for(const tag of ['animMotion','animRot','animScale','animEffect','audio'])expect([...result.matchAll(new RegExp(`<p:${tag}\\b`,'g'))]).toHaveLength([...source.matchAll(new RegExp(`<p:${tag}\\b`,'g'))].length);
 expect(result).toContain('Câu hỏi mới &amp; nội dung');
 for(const path of Object.keys(original.files).filter(p=>/^ppt\/media\/.*\.(gif|wav|mp3)$/i.test(p)))expect(await exported.file(path)!.async('base64')).toBe(await original.file(path)!.async('base64'));
 const presentation=await exported.file('ppt/presentation.xml')!.async('string');expect(presentation.match(/<p:sldSz[^>]+/)?.[0]).toBe((await original.file('ppt/presentation.xml')!.async('string')).match(/<p:sldSz[^>]+/)?.[0]);
 for(const path of Object.keys(exported.files).filter(p=>/^ppt\/slides\/_rels\/slide\d+\.xml.rels$/.test(p))){const rels=await exported.file(path)!.async('string');for(const target of rels.matchAll(/Target="(slide\d+\.xml)"/g))expect(exported.file(`ppt/slides/${target[1]}`)).not.toBeNull();}
},30000);
