import type { Mcq } from "../domain/studio-spec";
export const questionReference = "https://edulive.net/bai-giang-toan-lop-3-sach-canh-dieu-tap-1";
export type BankQuestion = { id: string; body: Mcq; revision: number; isDefault?: boolean; lesson?: string; subject?: string; grade?: number; textbook?: string };
export const defaultQuestions: BankQuestion[] = [];
function add(lesson: string, prompt: string, answer: string | number, wrong: (string | number)[], explanation: string, hint: string) {
 const n = defaultQuestions.length, id = `cd030001-0000-4000-8000-${String(n+1).padStart(12,'0')}`;
 const correct = n % 4, choices = wrong.map(String); choices.splice(correct,0,String(answer));
 defaultQuestions.push({id, revision:1, isDefault:true, lesson, subject:'Toán', grade:3, textbook:'Cánh Diều', body:{id,prompt,choices,correct,hint,explanation}});
}
for (const base of [3,4,6,7,8,9]) {
 for (const factor of [2,3,4,6,8,9]) {
  const result=base*factor;
  add(`Bảng nhân ${base}`, `${base} × ${factor} = ?`,result,[result-base,result+base,result+1],`${base} × ${factor} = ${result}.`,'Nhẩm theo bảng nhân đã học.');
 }
 for (const factor of [2,3,4,6,8,9]) {
  const result=base*factor;
  add(`Bảng chia ${base}`, `${result} : ${base} = ?`,factor,[factor+1,factor+2,factor===2?1:factor-1],`Vì ${base} × ${factor} = ${result} nên ${result} : ${base} = ${factor}.`,'Dùng phép nhân để tìm kết quả phép chia.');
 }
}
for (let i=1;i<=6;i++) {
 const number=200+i*101;
 add('Ôn tập các số đến 1000',`Số ${number} có chữ số hàng trăm là bao nhiêu?`,Math.floor(number/100),[0,1,9],`Chữ số hàng trăm của ${number} là ${Math.floor(number/100)}.`,'Đọc các hàng từ phải sang trái: đơn vị, chục, trăm.');
 const a=120+i*23,b=40+i*5;
 add('Ôn tập cộng, trừ trong phạm vi 1000',`${a} + ${b} = ?`,a+b,[a+b-10,a+b+10,a-b],`${a} + ${b} = ${a+b}.`,'Cộng lần lượt từ hàng đơn vị.');
 add('Mi li mét',`${i+1} cm bằng bao nhiêu mi-li-mét?`,(i+1)*10,[i+1,(i+1)*100,(i+1)*10+1],`1 cm = 10 mm nên ${i+1} cm = ${(i+1)*10} mm.`,'Mỗi xăng-ti-mét bằng 10 mi-li-mét.');
 add('Gấp một số lên một số lần',`Lan có ${i+2} nhãn vở. Nam có số nhãn vở gấp 3 lần Lan. Nam có bao nhiêu nhãn vở?`,(i+2)*3,[i+5,i+2,(i+2)*3+3],`Nam có: ${i+2} × 3 = ${(i+2)*3} (nhãn vở).`,'Gấp một số lên 3 lần thì nhân số đó với 3.');
 add('Giảm một số đi một số lần',`Giảm ${6*(i+1)} đi 3 lần được số nào?`,2*(i+1),[6*(i+1)-3,6*(i+1)+3,6*(i+1)*3],`${6*(i+1)} : 3 = ${2*(i+1)}.`,'Giảm một số đi 3 lần thì chia số đó cho 3.');
 add('Tìm thừa số chưa biết',`Điền số vào ô trống: □ × 3 = ${(i+2)*3}.`,i+2,[i+1,i+3,(i+2)*3],`Thừa số chưa biết là ${(i+2)*3} : 3 = ${i+2}.`,'Lấy tích chia cho thừa số đã biết.');
 const side=i+2;
 add('Chu vi hình vuông',`Hình vuông có cạnh ${side} cm. Chu vi hình vuông là bao nhiêu xăng-ti-mét?`,side*4,[side*4-2,side*4-1,side*4+1],`Chu vi là ${side} × 4 = ${side*4} (cm).`,'Hình vuông có 4 cạnh bằng nhau.');
 const length=i+5,width=i+1;
 add('Chu vi hình chữ nhật',`Hình chữ nhật dài ${length} cm, rộng ${width} cm. Chu vi là bao nhiêu xăng-ti-mét?`,(length+width)*2,[length+width,length*2+width,(length+width)*2+2],`Chu vi là (${length} + ${width}) × 2 = ${(length+width)*2} (cm).`,'Cộng chiều dài với chiều rộng rồi nhân 2.');
}
