const { Global } = require("@emotion/react");
const puppeteer = require("puppeteer");
const { writeFileSync } = require("fs");
const { sleep } = require("deasync");

const EXECUTABLEURLS = {
    vanilla: "https://mcversions.net/",
    spigot: "https://getbukkit.org/download/spigot",
    forge: "https://files.minecraftforge.net/net/minecraftforge/forge/",
};

async function ScrapeVanillaVersions() {
    const page = await Global.BROWSER.newPage();
    await page.goto("https://mcversions.net/");

    let urls = await page.evaluate(() => {
        let results = [];
        let items = document.querySelectorAll("a");

        items.forEach((item) => {
            const link = item.getAttribute("href");

            if (link.startsWith("/download")) {
                results.push({
                    url: "https://mcversions.net" + link,
                    text: link.slice(10, link.length),
                });
            }
        });

        return results;
    });
    page.close();
    return urls;
}

async function ScrapeVanillaFiles(sources) {
    const page = await Global.BROWSER.newPage();
    var results = [];

    if (sources.length == 0) {
        console.log("issues with sources");
    }

    for (let i = 0; i < sources.length; i++) {
        const selectedSource = sources[i];
        await page.goto(selectedSource["url"]);

        let result = await page.evaluate(() => {
            let results = "";
            let links = document.querySelectorAll("a");

            for (let x = 0; x < links.length; x++) {
                const item = links[x];
                if (item.innerText == "Download Server Jar") {
                    results = [item.download, item.href];
                    break;
                }
            }

            return results;
        });

        for (let i = 0; i < Global.vanillaResults.length; i++) {
            const selectedGlobalResult = Global.vanillaResults[i];

            // continue if there is no  server download for the given version
            if (result[1] == null) {
                continue;
            }

            // search until version is found 
            if (selectedGlobalResult[0] != selectedSource["text"]) {
                continue;
            }


            Global.vanillaResults[y].push(result[1]);
            break;
        }
    }

    page.close();
    Global.completeThreads += 1;
}

async function CompileVanillaFiles(sources) {
    const threadCount = 10;
    const x = Math.floor(sources.length / threadCount);
    const r = sources.length % threadCount;

    Global.vanillaResults = [];
    Global.completeThreads = 0;

    for (let i = 0; i < sources.length; i++) {
        const selectedSource = sources[i];
        Global.vanillaResults.push([selectedSource["text"]]);
    }

    for (let i = 0; i < threadCount; i++) {
        const start = i * x;
        var end = start + x + 1;

        if (i == threadCount - 1) {
            end += r;
        }

        const selectedSources = sources.slice(start, end);
        ScrapeVanillaFiles(selectedSources);
    }

    while (Global.completeThreads != threadCount) {
        await sleep(1);
    }

    resolve();

    return Global.vanillaResults;
}

async function main() {
    Global.BROWSER = await puppeteer.launch({ headless: false, dumpio: true });

    const vanillaData = await ScrapeVanillaVersions();
    writeFileSync("text2.json", JSON.stringify(vanillaData, "", "    "));

    const vanillaFiles = await CompileVanillaFiles(vanillaData);
    writeFileSync("text.json", JSON.stringify(vanillaFiles, "", "    "));

    console.log("all data has been written to file");
    Global.BROWSER.close();
}

main();
