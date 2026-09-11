// Classify service intent, never the presence of a STOP footer on a promotion.
export function messageKind(body){
 const text=body.replace(/\s+/g,' ').trim();
 if(/date of birth|\(DOB\)/i.test(text))return 'subscription';
 if(/error processing your message|inbox not staffed|reply\s+NO CARD|recorded as NO CARD|sign up for email notifications/i.test(text))return 'subscription';
 const operational=/reply\s+["']?yes\b.{0,35}(opt.in|birth|DOB|recurring)|reply was sent to|reply with your (full name|birthdate)|personalize the messages|you are now (signed up|a member)|thank you for (joining|subscribing)|we would love to know your name|we.ll send you a reminder|welcome.{0,100}(text|alerts|updates|offers|receive|msg)|you.ll receive information|you will receive information|texting messages will keep you up to date/i;
 if(operational.test(text))return 'subscription';
 if(/^(?:[^:]{1,70}:\s*)?(?:reply|text)\s+(?:STOP|HELP|OUT)\b/i.test(text))return 'subscription';
 if(/msg freq varies/i.test(text)&&/(sign up for special discounts|special offers for our members|special events, deals and promotions for loyal customers)/i.test(text))return 'subscription';
 return 'promotion';
}
