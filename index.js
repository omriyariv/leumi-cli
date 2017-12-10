#!/usr/bin/env node --harmony

const puppeteer = require('puppeteer');
const ora = require('ora');
const currencyFormatter = require('currency-formatter');
const Table = require('cli-table');

const toILS = val => currencyFormatter.format(val, { code: 'ILS' });

const headless = process.env.HEADLESS !== 'false';

const { USER, PASSWORD } = process.env;

const launchChrome = async () => {
  const browser = await puppeteer.launch({ headless });
  const page = await browser.newPage();
  return { browser, page };
};

const openHomePage = async page =>
  page.goto('https://hb2.bankleumi.co.il/H/Login.html', {
    waitUntil: 'networkidle'
  });

const login = async page => {
  await page.type('#uid', USER);
  await page.type('#password', PASSWORD);
  await page.click('#enter');
  await page.setCookie({ name: 'firstLogin', value: 'false' });
  return page.waitForSelector('#tab2');
};

const getSavingsAccountValues = async page => {
  await page.click('#tab2');
  await page.waitForSelector('.securities-strip');
  return page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('.securities-strip'));
    return spans.map(span => {
      const name = span
        .querySelector('.link-name-wrapper a')
        .textContent.trim();
      const textValue = span.querySelector('.last-title .value').textContent;
      const intValue = parseInt(textValue.replace(/[\.,]/g, '')) / 100;
      return [name, intValue];
    });
  });
};

const formattedOutput = values => {
  const table = new Table({
    head: ['Savings Account', 'Value'],
    colWidths: [30, 30]
  });
  let sum = 0;
  values.forEach(val => {
    table.push([val[0], toILS(val[1])]);
    sum += val[1];
  });
  table.push(['Total', toILS(sum)]);
  return table.toString();
};

const main = async () => {
  const step1 = launchChrome();
  ora.promise(step1, 'Launching Headless Chrome');
  const { page, browser } = await step1;

  const step2 = openHomePage(page);
  ora.promise(step2, 'Opening home page');
  await step2;

  const step3 = login(page);
  ora.promise(step3, 'Logging in');
  await step3;

  const step4 = getSavingsAccountValues(page);
  ora.promise(step4, 'Scraping values');
  const values = await step4;

  const step5 = browser.close();
  ora.promise(step5, 'Terminating Headless Chrome');
  await step5;
  console.log(formattedOutput(values));
};

main();
