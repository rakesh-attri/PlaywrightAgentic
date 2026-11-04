const http = require('node:http');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>SFQA Demo — Accounts</title>
<style>body{font:16px system-ui;margin:40px;background:#f3f6fb;color:#193450}button{background:#096bd8;color:white;border:0;border-radius:6px;padding:10px 16px;margin:8px}input,select{display:block;padding:10px;margin:8px 0 18px;width:300px}dialog{border:1px solid #cbd5e1;border-radius:12px;padding:24px}li{padding:12px}#error{color:#a60020}</style>
<h1>Accounts</h1><p>Local training fixture. This is not a Salesforce org.</p><button id="new">New Account</button><ul id="accounts"></ul>
<dialog id="form" aria-label="New Account"><h2>New Account</h2><label for="name">Account Name</label><input id="name"><label for="industry">Industry</label><select id="industry"><option>Technology</option><option>Education</option></select><p id="error" role="alert" data-testid="validation-error"></p><button id="save">Save</button><button id="cancel">Cancel</button></dialog>
<script>
const form=document.querySelector('#form'), nameInput=document.querySelector('#name');
document.querySelector('#new').onclick=()=>{nameInput.value='';document.querySelector('#industry').value='Technology';document.querySelector('#error').textContent='';form.showModal()};
document.querySelector('#cancel').onclick=()=>form.close();
document.querySelector('#save').onclick=()=>{if(!nameInput.value.trim()){document.querySelector('#error').textContent='Account Name is required';return}const row=document.createElement('li');row.textContent=nameInput.value+' — '+document.querySelector('#industry').value;document.querySelector('#accounts').append(row);form.close()};
</script></html>`;
http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(html)}).listen(8765,'127.0.0.1',()=>console.log('Demo ready on 127.0.0.1:8765'));
