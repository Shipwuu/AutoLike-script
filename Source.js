// ==UserScript==
// @name         AniList AutoLiker by ~Shipuu
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Auto-like, Saved Activity IDs [This code uses helped by AI]
// @match        https://anilist.co/*
// @grant        GM_xmlhttpRequest
// @connect      anilist.co
// ==/UserScript==

(function () {
  'use strict';
  
  
  const BLACKLIST_USER = "_You're Usernae Here_"; // add you're username to blacklist self activity 
  const DELAY = 20;
  const CACHE_KEY = "al_liked_cache";
  
  const likedCache = new Set(
      JSON.parse(localStorage.getItem(CACHE_KEY) || "[]")
  );

function saveCache() {
    localStorage.setItem(
        CACHE_KEY,
        JSON.stringify([...likedCache])
    );
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isAlreadyLiked(btn) {
    if (!btn) return false;

    const cls = (btn.className || "").toLowerCase();

    if (cls.includes("liked")) return true;
    if (btn.getAttribute("aria-pressed") === "true") return true;

    return false;
}

function findActivityId(node) {
    const dataNode = node.closest("[data-id]");

    if (dataNode) {
        const id = parseInt(dataNode.getAttribute("data-id"));
        if (!isNaN(id)) return id;
    }

    const link = node.querySelector('a[href^="/activity/"]');

    if (link) {
        const id = parseInt(
            link.getAttribute("href").split("/").pop()
        );

        if (!isNaN(id)) return id;
    }

    return null;
}

function getUserName(node) {
    const userLink = node.querySelector(
        'a.name[href^="/user/"]'
    );

    if (!userLink) return null;

    return userLink
        .getAttribute("href")
        .replace("/user/", "")
        .replace(/\//g, "");
}

function collect() {

    const buttons = Array.from(
        document.querySelectorAll(
            '.action.likes .button, .like-wrap .button'
        )
    );

    const result = [];

    for (const btn of buttons) {

        if (isAlreadyLiked(btn))
            continue;

        const activity =
            btn.closest(".activity-entry") ||
            btn.parentElement;

        if (!activity)
            continue;

        const username = getUserName(activity);

        if (
            username &&
            username.toLowerCase() ===
            BLACKLIST_USER.toLowerCase()
        ) {
            continue;
        }

        const activityId =
            findActivityId(activity);

        if (!activityId)
            continue;

        if (likedCache.has(activityId))
            continue;

        result.push({
            id: activityId,
            btn,
            user: username || "Unknown"
        });
    }

    return result;
}

function sendLike(id) {

    return new Promise(resolve => {

        GM_xmlhttpRequest({
            method: "POST",
            url: "https://anilist.co/graphql",

            headers: {
                "content-type": "application/json"
            },

            data: JSON.stringify({
                query: `
                mutation($id:Int,$type:LikeableType){
                    ToggleLike:ToggleLikeV2(
                        id:$id,
                        type:$type
                    ){
                        ... on ListActivity {
                            id
                            isLiked
                        }
                        ... on TextActivity {
                            id
                            isLiked
                        }
                        ... on MessageActivity {
                            id
                            isLiked
                        }
                    }
                }`,
                variables: {
                    id,
                    type: "ACTIVITY"
                }
            }),

            onload: response => {

                try {

                    const json =
                        JSON.parse(
                            response.responseText
                        );

                    resolve({
                        success:
                            json.data?.ToggleLike?.isLiked === true,
                        errors:
                            json.errors || [],
                        raw: json
                    });

                } catch (err) {

                    resolve({
                        success: false,
                        errors: [
                            {
                                message:
                                    "JSON Parse Error"
                            }
                        ]
                    });
                }
            },

            onerror: () => {

                resolve({
                    success: false,
                    errors: [
                        {
                            message:
                                "Network Error"
                        }
                    ]
                });
            }
        });
    });
}

function addUI() {

    if (
        document.getElementById("al-btn")
    ) {
        return;
    }

    const nav =
        document.querySelector(".links");

    if (!nav)
        return;

    const autoBtn =
        document.createElement("button");

    autoBtn.id = "al-btn";
    autoBtn.textContent = "Like";

    autoBtn.style =
        "margin-left:10px;padding:6px 10px;border:0;border-radius:6px;background:#e85d75;color:#fff;cursor:pointer;";

    const logBtn =
        document.createElement("button");

    logBtn.textContent = "Log";

    logBtn.style =
        "margin-left:10px;padding:6px 10px;border:0;border-radius:6px;background:#3b82f6;color:#fff;cursor:pointer;";

    const clearBtn =
        document.createElement("button");

    clearBtn.textContent =
        "Clear";

    clearBtn.style =
        "margin-left:10px;padding:6px 10px;border:0;border-radius:6px;background:#ef4444;color:#fff;cursor:pointer;";

    nav.parentNode.insertBefore(
        autoBtn,
        nav.nextSibling
    );

    nav.parentNode.insertBefore(
        logBtn,
        autoBtn.nextSibling
    );

    nav.parentNode.insertBefore(
        clearBtn,
        logBtn.nextSibling
    );

    document.addEventListener("keydown", (e) => {

    // Ignore when typing in inputs/textareas
    const tag = document.activeElement?.tagName;

    if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        document.activeElement?.isContentEditable
    ) {
        return;
    }

    switch (e.key.toLowerCase()) {

        case "z":
            autoBtn.click();
            break;

        case "x":
            logBtn.click();
            break;

        case "c":
            clearBtn.click();
            break;
    }
});

    const panel =
        document.createElement("div");

    panel.style =
        "position:fixed;bottom:20px;right:20px;width:120px;height:600px;background:rgba(0,0,0,0.88);color:#fff;font-size:7px;border-radius:8px;padding:6px;display:none;resize:both;overflow:auto;z-index:9999;";

    const header =
        document.createElement("div");

    header.textContent =
        "Auto Like Log";

    header.style =
        "font-weight:bold;margin-bottom:5px;";

    panel.appendChild(header);

    const logs =
        document.createElement("div");

    panel.appendChild(logs);

    document.body.appendChild(panel);

    function log(msg) {

        const line =
            document.createElement("div");

        line.textContent =
            `[${new Date().toLocaleTimeString()}] ${msg}`;

        logs.appendChild(line);

        logs.scrollTop =
            logs.scrollHeight;
    }

    log(
        `Cache loaded: ${likedCache.size} activities`
    );

    logBtn.onclick = () => {

        panel.style.display =
            panel.style.display === "none"
                ? "block"
                : "none";
    };

    clearBtn.onclick = () => {

        if (
            !confirm(
                `Delete ${likedCache.size} cached activities?`
            )
        ) {
            return;
        }

        likedCache.clear();
        saveCache();

        log("Cache cleared.");
        alert("Cache cleared.");
    };

    autoBtn.onclick = async () => {


autoBtn.disabled = true;

const activities = collect();

if (activities.length === 0) {

    alert("There are no new activities to like.");

    autoBtn.disabled = false;
    return;
}

log(`Found ${activities.length} new activities.`);

let success = 0;
let skipped = 0;

for (let i = 0; i < activities.length; i++) {

    const activity = activities[i];

    const result = await sendLike(activity.id);

    if (result.success) {

        success++;

        likedCache.add(activity.id);
        saveCache();

        log(
            `✔ ${activity.user}`
        );

    } else {

        const errors = result.errors || [];

        const firstError = errors[0] || {};

        const errorMessage =
            firstError.message || "";

        const errorStatus =
            firstError.status || 0;

        // RATE LIMIT
        if (
            errorStatus === 429 ||
            errorMessage.includes(
                "Too many likes created recently"
            )
        ) {

            log(
                `⛔ Rate limit reached (1 minute timeout)`
            );

            autoBtn.disabled = false;
            return;
        }

        // USER CANNOT RECEIVE LIKES
        if (
            errorStatus === 400 &&
            errorMessage.includes(
                "cannot currently receive likes"
            )
        ) {

            skipped++;

            likedCache.add(activity.id);
            saveCache();

            log(
                `⏭ Skipped activity ${activity.id} (${activity.user} cannot receive likes)`
            );

            continue;
        }

        // OTHER ERRORS
        log(
            `Failed activity ${activity.id}`
        );

        log(
            `Error: ${JSON.stringify(errors)}`
        );

        // Cache unknown failures so script doesn't get stuck forever
        skipped++;

        likedCache.add(activity.id);
        saveCache();

        log(
            `Skipped activity ${activity.id} due to error`
        );

        continue;
    }

    await sleep(DELAY);
}

log(
    `${success} liked | ${skipped} skipped.`
);

log(
    `IDs: ${likedCache.size}`
);

autoBtn.disabled = false;
};
};

new MutationObserver(addUI).observe(
    document.body,
    {
        childList: true,
        subtree: true
    }
);

addUI();
})();
