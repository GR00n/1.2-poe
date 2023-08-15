import parser from "node-html-parser";
import puppeteer from "puppeteer-extra";
import stealth from "puppeteer-extra-plugin-stealth"
import dotenv from "dotenv";
import fs from "fs"
import chalk from "chalk";

import {UpdateConsole} from "./index.js"

dotenv.config();


// CONFIG
import { 

  COOKIE, 
  MAXPROMPT,
  RULES, 
  BAD

} from "./config.js"
let systemmsgs = []
let botname
let charname
let page
let browser

UpdateConsole(`Starting... 0/5`)

async function initializeDriver() {
  UpdateConsole(`Starting Driver... 0/5`)

  puppeteer.use(stealth())

  browser = await puppeteer.launch({headless: "new"})
  page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 768});
  await page.goto("https://poe.com/")
  await page.setCookie({name: 'p-b',value: COOKIE});

  UpdateConsole(`Driver Started... 1/5`)
}
async function createBot(){
  try {
    UpdateConsole(`Creating Bot... 2/5`)

    await page.goto("https://poe.com/create_bot")
    await page.setCookie({name: 'p-b',value: COOKIE});

    // Selectors
    const [prompt_textfield] = await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/form/div[6]/textarea`);
    const [model_select] = await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/form/div[5]/div[2]/select`);
    const [button] = await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/form/div[11]/button`);
    const [name] = await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/form/div[2]/input`)

    
    if (process.env.ID == ""){
      const uuid = `${RandomString(6)}`
      SetID(uuid)
    }
    botname = `${charname}_ID_${process.env.ID}`
    .replace(" ","")

    await page.evaluate((element, value) => 
    element.value = 
      value,  
      name, 
      botname
    );
    await name.press("Enter")

    let prompt_message;

    systemmsgs.forEach(system => {
      prompt_message += system
    });
    RULES.forEach(rule => {
      prompt_message += rule
    });

    await prompt_textfield.type(" ")

    await page.evaluate(
      (element, value) => element.value = value,  
      prompt_textfield, 
      prompt_message
    );
    await model_select.select('chinchilla');

    await button.click()

    UpdateConsole(`Bot Created... 3/5`)
  } catch (error) {
    await createBot()
  }
}
async function editBot(){ 
  try {

    await page.goto(`https://poe.com/edit_bot?bot=${botname}`)
    await page.setCookie({name: 'p-b',value: COOKIE})

    const [prompt_textfield] = await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/form/div[5]/textarea`)
    const [button] = await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/form/div[10]/button`)

    let prompt_message;
    systemmsgs.forEach(system => {
      prompt_message += system
    });
    RULES.forEach(rule => {
      prompt_message += rule
    });

    await prompt_textfield.type(" ")
    await page.evaluate(
      (element, value) => element.value = value,  
      prompt_textfield, 
      prompt_message
    );
    button.click()
  } catch (error) {
    if (await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/div`)){
      await createBot()
    }else{
      await editBot()
    }
  }
}
// TODO: clean up the code abit
async function getResult(){
  try {
    const selector = '//*[@id="__next"]/div[1]/div/section/div[2]/div/div/button';

    await page.waitForXPath(selector);    
    const [element] = await page.$x(selector);    
    await page.waitForFunction(elem => elem.parentNode === null, {}, element);

    let lastmsg = "";
    let root = parser.parse(await page.content());
    let out = root.querySelectorAll(".Markdown_markdownContainer__UyYrv");
    let lastbubble = out[out.length - 1].querySelectorAll("p");
    
    for (let bubble of lastbubble) {
      lastmsg += bubble.innerHTML;
      lastmsg += "\n";
    }

    return lastmsg

    .replace(/<em>/g, "*")
    .replace(/<\/em>/g, "*")
    .replace(/<br>/g, "")
    .replace(/<p>/g, "")
    .replace(/<\/p>/g, "")
    .replace('<a node="[object Object]" class="MarkdownLink_linkifiedLink__KxC9G">',"")
    .replace(/<\/a>/g, "")
    .replace('<code node="[object Object]">', "")
    .replace(/<\/code>/g, "")
    .replace("You:","");
    
  } catch (error) {
    await getResult()
  }
}
async function sendMessages(input) {  
  dotenv.config({override: true});
  UpdateConsole(`Sending Messages... 3/5`)
  let messages = input
  try {
    if (botname != "")
    {
      await page.goto(`https://poe.com/${botname}`)
    }

    const selector = '//*[@id="__next"]/div[1]/div/section/div[2]/div/div/button';
    let textfield = await page.waitForXPath(`//*[@id="__next"]/div[1]/div/section/div[2]/div/div/footer/div/div/div[1]/textarea`)
    let i = 0
    const context_clear = await page.waitForXPath(`//*[@id="__next"]/div[1]/div/section/div[2]/div/div/footer/div/button`)

    await context_clear.click()
    while (messages.length >= i) {
      let message = messages[i]
      
      await page.evaluate((element, value) => element.value = value,  textfield, message)

      setTimeout(function() {
        textfield.type(" ")
        textfield.press("Enter")
      }, 500);
      i++
      if (i == messages.length){
        break
      }
      await page.waitForXPath(selector);
      const [element] = await page.$x(selector);    
      await page.waitForFunction(elem => elem.parentNode === null, {}, element);
    }

    UpdateConsole(`Send Messages... 4/5`)
  } catch (error) {
    if (await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/div`)){
      await createBot()
      await sendMessages(input)
    }else{
      await sendMessages(input)
    }
  }
}


async function messageContructor(messages){
  UpdateConsole(`Getting CharacterName... 1/5`)

  let systemsplit = messages[0].content.split("'s");
  for (let sentence of systemsplit) {
    var startingString = 'H: You will be acting as';
    var endingString = '.';

    var startIndex = sentence.indexOf(startingString);
    var endIndex = sentence.indexOf(endingString, startIndex + startingString.length);

    if (startIndex !== -1 && endIndex !== -1) {
      var extractedString = sentence.substring(startIndex + startingString.length, endIndex);
      charname = String(extractedString).replace(",","")
    }
  }
  let res_message;

  systemmsgs = []
  let send = [];
  let result = [];

  UpdateConsole(`Compiling Messages... 1/5`)

  for (let message of messages) {
    if (message.role === "system") {
      systemmsgs.push(message.content);
    } else if (message.role === "assistant") {
      res_message += `${charname}: ${message.content}`+ "\n";
    } else if (message.role === "user") {
      res_message += `user: ${message.content}`+ "\n";
    }
  }

  UpdateConsole(`SplitingStrings... 1/5`)
  if (String(res_message).length >= 5000){
    result = Split(res_message,MAXPROMPT,".")
  }else{
    result.push(res_message)
  }

  UpdateConsole(`Finishing Up... 1/5`)
  result.forEach(mes => {
    send.push(
    `
    Generate a Response according to 
    these chat messages in character \n

    \n
    Chat [\n ${mes}\n]
    `)
  });
  UpdateConsole(`Finished... 2/5`)
  return (send)
}

async function sagedriverCompletion(req, res) {
  dotenv.config({override: true});

  UpdateConsole(`Finishing Up... 4/5`)

  if (req.body.stream == true) {
  } else {
    await initializeDriver();
    let send = await messageContructor(req.body.messages);


    try {
      page.goto(`https://poe.com/${botname}`)

      let icon = await page.$x(`//*[@id="__next"]/div[1]/div/aside/div/header`)

      if (icon){
        await editBot()
      }else{
        await createBot()
      }
    }catch(error){
      await createBot()
    }

    await sendMessages(send)

    let maxtoken = req.body.max_tokens;
    let lastmsg = await getResult();
    let newres = await convertPOEtoOAI(lastmsg, maxtoken);
    if (typeof newres == "object") newres = JSON.parse(JSON.stringify(newres));

    // message selector
    let message = newres.choices[0].message.content;
    
    browser.close();
    if (BAD.some(str => message.startsWith(str)) || message.includes("User:")){

      await sagedriverCompletion(req, res)
    }else{
      UpdateConsole(`All Done... 5/5`)
      res.status(200).json(newres);   
    }
  }
}

async function convertPOEtoOAI(messages, maxTokens) {
  let messageout = messages;
  let newresponse = {
    id: "chatcmpl-7ep1aerr8frmSjQSfrNnv69uVY0xM",
    object: "chat.completion",
    created: Date.now(),
    model: "gpt-3.5-turbo-0613",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: `${messageout}`,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 724,
      completion_tokens: 75,
      total_tokens: 799,
    },
  };
  return newresponse;
}



// Some extra Functions 😒
function RandomString(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}
function SetID(input){
      fs.readFile('.env', 'utf8', (err, data) => {
      if (err) {
          console.error(err);
          return;
        }
        const updatedData = data.replace(/^ID=.*/m, `ID=${input}`);

        fs.writeFile('.env', updatedData, 'utf8', (err) => {
          if (err) {
            console.error(err);
            return;
          }
        });
      });
}
function Split(str, length, backChar) {
  const result = [];
  let index = 0;

  let Message = 
  `
  if you understand this only Respont with "Understood." 
  and nothing else wait for the message without this under it than respont appropriately according to the senario 
  `

  while (index < str.length) {
    let substring = str.substring(index, index + length);

    if (substring.includes(backChar)) {
      const backCharIndex = substring.lastIndexOf(backChar);
      substring = substring.substring(0, backCharIndex + 1);
      index += backCharIndex + 1;
    } else {
      index += length;
    }

    result.push(substring + (index < str.length ? Message : ''));
  }

  return result;
}

export { sagedriverCompletion };