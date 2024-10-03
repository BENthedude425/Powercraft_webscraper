const puppeteer = require("puppeteer");
const { writeFileSync } = require("fs");
const { sleep } = require("deasync");

const STARTTIME = Date.now()

URLS = {
    vanilla: "https://mcversions.net/",
    spigot: "https://getbukkit.org/download/spigot/",
    forge: "https://files.minecraftforge.net/net/minecraftforge/forge/",
};

async function GetVanillaSources() {
    const page = await browser.newPage();
    await page.goto(URLS["vanilla"]);

    let urls = await page.evaluate(() => {
        let results = [];
        let items = document.querySelectorAll("a");

        items.forEach((item) => {
            const link = item.getAttribute("href");

            if (link.startsWith("/download")) {
                results.push({
                    url: "https://mcversions.net/" + link,
                    version: link.slice(10, link.length),
                });
            }
        });

        return results;
    });

    page.close();
    return urls;
}

async function GetVanillaFiles(sources, threadData) {
    const page = await global.browser.newPage();

    for (let i = 0; i < sources.length; i++) {
        const selectedSource = sources[i];
        await page.goto(selectedSource["url"]);

        let result = await page.evaluate(() => {
            let file = [];
            let links = document.querySelectorAll("a");

            for (let x = 0; x < links.length; x++) {
                const item = links[x];
                if (item.innerText == "Download Server Jar") {
                    var fileName = item.download;

                    if (fileName.endsWith(".jar")) {
                        fileName = fileName.slice(0, fileName.length - 4);
                    }

                    file = {
                        file: fileName,
                        link: item.href,
                    };
                    break;
                }
            }

            return file;
        });

        if (result.link == null) {
            continue;
        }

        const version = result.file.split("-")[1];
        threadData.results[version] = result;
    }

    page.close();
    threadData.completeThreads += 1;
}

async function ProcessFiles(sources, getfilecall) {
    const STARTTIME = Date.now()
    const threadCount = 20;
    const x = Math.floor(sources.length / threadCount);
    const r = sources.length % threadCount;

    threadData = {
        results: {},
        completeThreads: 0,
    };

    // Populate the object with each version in order
    for (let i = 0; i < sources.length; i++) {
        const selectedSource = sources[i];
        threadData.results[selectedSource.version] = "";
    }

    for (let i = 0; i < threadCount; i++) {
        const start = i * x;
        var end = start + x + 1;

        if (i == threadCount - 1) {
            end += r;
        }

        const selectedSources = sources.slice(start, end);
        getfilecall(selectedSources, threadData);
    }

    while (threadData.completeThreads != threadCount) {
        await sleep(1);
    }

    console.log("Cleaning up...\n");

    const keys = Object.keys(threadData.results);
    for (let i = 0; i < keys.length; i++) {
        const selectedKey = keys[i];
        if (!CheckData(threadData.results[selectedKey])) {
            delete threadData.results[selectedKey];
        }
    }

    const timeTaken = (Date.now() - STARTTIME) / 1000
    console.log(`Took ${timeTaken}s`)

    return threadData.results;
}

async function GetForgeSources() {
    const page = await browser.newPage();
    await page.goto(URLS["forge"]);

    let urls = await page.evaluate((URLS) => {
        let sources = [];
        const items = document.querySelectorAll("a");

        for (let i = 0; i < items.length; i++) {
            const selectedItem = items[i];

            if (!selectedItem.href.startsWith(URLS["forge"] + "index_")) {
                continue;
            }

            sources.push({
                url: selectedItem.href,
                version: selectedItem.text,
            });
        }

        return sources;
    }, URLS);

    return urls;
}

async function GetForgeFiles(sources, threadData) {
    const page = await browser.newPage();

    for (i = 0; i < sources.length; i++) {
        const selectedSource = sources[i];

        await page.goto(selectedSource["url"]);
        const UrlArray = await page.evaluate(() => {
            const items = document.querySelectorAll("a");
            let links = [];
            // required as all downloads are listed twice
            let flipper = false;

            for (let i = 0; i < items.length; i++) {
                const selectedItem = items[i];

                if (flipper) {
                    flipper = !flipper;
                    continue;
                }

                if (
                    !selectedItem.href.startsWith(
                        "https://maven.minecraftforge.net/net/minecraftforge/forge"
                    )
                ) {
                    continue;
                }

                if (!selectedItem.href.endsWith("installer.jar")) {
                    continue;
                }

                const link = selectedItem.href;
                let fileRelease = link.split("-");
                fileRelease = fileRelease[fileRelease.length - 2];

                // Add found release to the object
                links.push({
                    release: fileRelease,
                    link: link,
                });

                flipper = !flipper;
            }

            return links;
        });

        threadData.results[selectedSource["version"]] = UrlArray;
    }

    page.close();
    threadData.completeThreads += 1;
}

function CheckData(data) {
    if (data == null) {
        return false;
    }

    if (data.length == 0) {
        return false;
    }

    return true;
}

async function main() {
    browser = await puppeteer.launch({ headless: false });

    console.log("Gathering vanilla server files...");
    const vanillaSources = await GetVanillaSources();
    const vanillaFiles = await ProcessFiles(vanillaSources, GetVanillaFiles);

    //writeFileSync("text2.json", JSON.stringify(vanillaSources, "", "    "));

    console.log("Gathering forge server files..");
    const forgeSources = await GetForgeSources();
    const forgeFiles = await ProcessFiles(forgeSources, GetForgeFiles);

    const allFiles = {
        Vanilla: vanillaFiles,
        Forge: forgeFiles,
    };

    await writeFileSync("text.json", JSON.stringify(allFiles, "", "    "));

    console.log("all data has been written to file");
    browser.close();

    console.log(Date.now(), STARTTIME)
    
    const timeTaken = (Date.now() - STARTTIME) / 1000
    console.log(`Collected ${allFiles.length} items in ${timeTaken}s`)
}

main();