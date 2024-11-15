/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.defineESModuleGetters(this, {
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
});

add_setup(async function setup() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.urlbar.scotchBonnet.enableOverride", true]],
  });
});

add_task(async function disabled_unified_button() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.urlbar.scotchBonnet.enableOverride", false]],
  });

  await TestUtils.waitForCondition(() => {
    return !BrowserTestUtils.isVisible(
      gURLBar.querySelector("#urlbar-searchmode-switcher")
    );
  });

  Assert.equal(
    BrowserTestUtils.isVisible(
      gURLBar.querySelector("#urlbar-searchmode-switcher")
    ),
    false,
    "Unified Search Button should not be visible."
  );

  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    value: "",
  });

  Assert.equal(
    BrowserTestUtils.isVisible(
      gURLBar.querySelector("#urlbar-searchmode-switcher")
    ),
    false,
    "Unified Search Button should not be visible."
  );

  await UrlbarTestUtils.enterSearchMode(window, {
    source: UrlbarUtils.RESULT_SOURCE.BOOKMARKS,
  });

  Assert.equal(
    BrowserTestUtils.isVisible(
      gURLBar.querySelector("#searchmode-switcher-chicklet")
    ),
    false,
    "Chicklet associated with Unified Search Button should not be visible."
  );

  await UrlbarTestUtils.exitSearchMode(window);
  await SpecialPowers.popPrefEnv();
});

add_task(async function basic() {
  info("Open the urlbar and searchmode switcher popup");
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    value: "",
  });
  let popup = await UrlbarTestUtils.openSearchModeSwitcher(window);
  Assert.ok(
    !BrowserTestUtils.isVisible(gURLBar.view.panel),
    "The UrlbarView is not visible"
  );

  info("Press on the bing menu button and enter search mode");
  let popupHidden = UrlbarTestUtils.searchModeSwitcherPopupClosed(window);
  popup.querySelector("toolbarbutton[label=Bing]").click();
  await popupHidden;

  await UrlbarTestUtils.assertSearchMode(window, {
    engineName: "Bing",
    entry: "searchbutton",
    source: 3,
  });

  info("Press the close button and escape search mode");
  window.document.querySelector("#searchmode-switcher-close").click();
  await UrlbarTestUtils.assertSearchMode(window, null);
});

add_task(async function privileged_chicklet() {
  let tab = await BrowserTestUtils.openNewForegroundTab(
    window.gBrowser,
    "about:config"
  );

  Assert.ok(
    BrowserTestUtils.isVisible(
      tab.ownerGlobal.document.querySelector("#identity-box")
    ),
    "Chicklet is visible on privileged pages."
  );

  BrowserTestUtils.removeTab(tab);
});

function updateEngine(fun) {
  let updated = SearchTestUtils.promiseSearchNotification(
    SearchUtils.MODIFIED_TYPE.CHANGED,
    SearchUtils.TOPIC_ENGINE_MODIFIED
  );
  fun();
  return updated;
}

add_task(async function new_window() {
  let oldEngine = Services.search.getEngineByName("Bing");
  await updateEngine(() => {
    oldEngine.hidden = true;
  });

  let newWin = await BrowserTestUtils.openNewBrowserWindow();

  info("Open the urlbar and searchmode switcher popup");
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window: newWin,
    value: "",
  });
  let popup = await UrlbarTestUtils.openSearchModeSwitcher(newWin);

  info("Open popup and check list of engines is redrawn");
  let popupHidden = UrlbarTestUtils.searchModeSwitcherPopupClosed(newWin);
  Assert.ok(
    !popup.querySelector(`toolbarbutton[label=${oldEngine.name}]`),
    "List has been redrawn"
  );
  popup.querySelector("toolbarbutton[label=Google]").click();
  await popupHidden;
  newWin.document.querySelector("#searchmode-switcher-close").click();

  await Services.search.restoreDefaultEngines();
  await BrowserTestUtils.closeWindow(newWin);
});

add_task(async function detect_searchmode_changes() {
  info("Open the urlbar and searchmode switcher popup");
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    value: "",
  });
  let popup = await UrlbarTestUtils.openSearchModeSwitcher(window);

  info("Press on the bing menu button and enter search mode");
  let popupHidden = UrlbarTestUtils.searchModeSwitcherPopupClosed(window);
  popup.querySelector("toolbarbutton[label=Bing]").click();
  await popupHidden;

  await UrlbarTestUtils.assertSearchMode(window, {
    engineName: "Bing",
    entry: "searchbutton",
    source: 3,
  });

  info("Press the close button and escape search mode");
  window.document.querySelector("#searchmode-switcher-close").click();
  await UrlbarTestUtils.assertSearchMode(window, null);

  await BrowserTestUtils.waitForCondition(() => {
    return (
      window.document.querySelector("#searchmode-switcher-title").textContent ==
      ""
    );
  }, "The searchMode name has been removed when we exit search mode");
});

async function focusSwitcher(win = window) {
  if (!win.gURLBar.focused) {
    let focus = BrowserTestUtils.waitForEvent(win.gURLBar.inputField, "focus");
    EventUtils.synthesizeKey("l", { accelKey: true }, win);
    await focus;
  }
  EventUtils.synthesizeKey("KEY_Tab", { shiftKey: true }, win);
}

/**
 * Test we can open the SearchModeSwitcher with various keys
 *
 * @param {string} openKey - The keyboard character used to open the popup.
 */
async function test_open_switcher(openKey) {
  let popup = UrlbarTestUtils.searchModeSwitcherPopup(window);
  let promiseMenuOpen = BrowserTestUtils.waitForEvent(popup, "popupshown");

  info(`Open the urlbar and open the switcher via keyboard (${openKey})`);
  await focusSwitcher();
  EventUtils.synthesizeKey(openKey);
  await promiseMenuOpen;

  EventUtils.synthesizeKey("KEY_Escape");
}

/**
 * Test that not all characters will open the SearchModeSwitcher
 *
 * @param {string} dontOpenKey - The keyboard character we will ignore.
 */
async function test_dont_open_switcher(dontOpenKey) {
  let popup = UrlbarTestUtils.searchModeSwitcherPopup(window);

  let popupOpened = false;
  let opened = () => {
    popupOpened = true;
  };
  info("Pressing key that should not open the switcher");
  popup.addEventListener("popupshown", opened);
  await focusSwitcher();
  EventUtils.synthesizeKey(dontOpenKey);

  /* eslint-disable mozilla/no-arbitrary-setTimeout */
  await new Promise(r => setTimeout(r, 50));
  Assert.ok(!popupOpened, "The popup was not opened");
  popup.removeEventListener("popupshown", opened);
}

/**
 * Test we can navigate the SearchModeSwitcher with various keys
 *
 * @param {string} navKey - The keyboard character used to navigate.
 * @param {Int} navTimes - The number of times we press that key.
 * @param {object} searchMode - The searchMode that we expect to select.
 */
async function test_navigate_switcher(navKey, navTimes, searchMode) {
  let popup = UrlbarTestUtils.searchModeSwitcherPopup(window);
  let promiseMenuOpen = BrowserTestUtils.waitForEvent(popup, "popupshown");

  info("Open the urlbar and open the switcher via Enter key");
  await focusSwitcher();
  EventUtils.synthesizeKey("KEY_Enter");
  await promiseMenuOpen;

  info("Select first result and enter search mode");
  for (let i = 0; i < navTimes; i++) {
    EventUtils.synthesizeKey(navKey);
  }
  EventUtils.synthesizeKey("KEY_Enter");
  await UrlbarTestUtils.promiseSearchComplete(window);

  await UrlbarTestUtils.assertSearchMode(window, searchMode);

  info("Exit the search mode");
  await UrlbarTestUtils.promisePopupClose(window, () => {
    EventUtils.synthesizeKey("KEY_Escape");
  });
  EventUtils.synthesizeKey("KEY_Escape");
  await UrlbarTestUtils.assertSearchMode(window, null);
}

// TODO: Don't let tests depend on the actual search config.
let amazonSearchMode = {
  engineName: "Amazon.com",
  entry: "searchbutton",
  isPreview: false,
  isGeneralPurposeEngine: true,
};
let bingSearchMode = {
  engineName: "Bing",
  isGeneralPurposeEngine: true,
  source: 3,
  isPreview: false,
  entry: "searchbutton",
};

add_task(async function test_keyboard_nav() {
  await test_open_switcher("KEY_Enter");
  await test_open_switcher("KEY_ArrowDown");
  await test_open_switcher(" ");

  await test_dont_open_switcher("a");
  await test_dont_open_switcher("KEY_ArrowUp");
  await test_dont_open_switcher("x");

  await test_navigate_switcher("KEY_Tab", 1, amazonSearchMode);
  await test_navigate_switcher("KEY_ArrowDown", 1, amazonSearchMode);
  await test_navigate_switcher("KEY_Tab", 2, bingSearchMode);
  await test_navigate_switcher("KEY_ArrowDown", 2, bingSearchMode);
});

add_task(async function open_settings() {
  let popup = UrlbarTestUtils.searchModeSwitcherPopup(window);
  let promiseMenuOpen = BrowserTestUtils.waitForEvent(popup, "popupshown");

  info("Open the urlbar and open the switcher via Enter key");
  await focusSwitcher();
  EventUtils.synthesizeKey("KEY_Enter");
  await promiseMenuOpen;

  let pageLoaded = BrowserTestUtils.browserLoaded(window);
  EventUtils.synthesizeKey("KEY_ArrowUp");
  EventUtils.synthesizeKey("KEY_Enter");
  await pageLoaded;

  Assert.equal(
    window.gBrowser.selectedBrowser.currentURI.spec,
    "about:preferences#search",
    "Opened settings page"
  );

  // Clean up.
  let onLoaded = BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
  gBrowser.selectedBrowser.loadURI(Services.io.newURI("about:newtab"), {
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  await onLoaded;
});

add_task(async function open_settings_with_there_is_already_opened_settings() {
  info("Open settings page in a tab");
  let startTab = gBrowser.selectedTab;
  let preferencesTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:preferences#search"
  );
  gBrowser.selectedTab = startTab;

  info("Open new window");
  let newWin = await BrowserTestUtils.openNewBrowserWindow();
  let popup = UrlbarTestUtils.searchModeSwitcherPopup(newWin);
  let promiseMenuOpen = BrowserTestUtils.waitForEvent(popup, "popupshown");

  info("Open the urlbar and open the switcher via keyboard in the new window");
  await focusSwitcher(newWin);
  EventUtils.synthesizeKey("KEY_Enter", {}, newWin);
  await promiseMenuOpen;

  info(
    "Choose open settings item and wait until the window having perference page will get focus"
  );
  let onFocus = BrowserTestUtils.waitForEvent(window, "focus", true);
  EventUtils.synthesizeKey("KEY_ArrowUp", {}, newWin);
  EventUtils.synthesizeKey("KEY_Enter", {}, newWin);
  await onFocus;
  Assert.ok(true, "The window that has perference page got focus");

  await BrowserTestUtils.waitForCondition(
    () => window.gBrowser.selectedTab == preferencesTab
  );
  Assert.ok(true, "Focus opened settings page");

  BrowserTestUtils.removeTab(preferencesTab);
  await BrowserTestUtils.closeWindow(newWin);
});

async function setDefaultEngine(name) {
  let engine = (await Services.search.getEngines()).find(e => e.name == name);
  Assert.ok(engine);
  await Services.search.setDefault(
    engine,
    Ci.nsISearchService.CHANGE_REASON_UNKNOWN
  );
}

add_task(async function test_search_icon_change() {
  const defaultEngine = await Services.search.getDefault();
  const engineName = "DuckDuckGo";
  await setDefaultEngine(engineName);
  let newWin = await BrowserTestUtils.openNewBrowserWindow();

  let searchModeSwitcherButton = window.document.getElementById(
    "searchmode-switcher-icon"
  );

  // match and capture the URL inside `url("...")`
  let regex = /url\("([^"]+)"\)/;
  let searchModeSwitcherIconUrl =
    searchModeSwitcherButton.style.listStyleImage.match(regex);

  const defaultSearchEngineIconUrl = await Services.search
    .getEngineByName(engineName)
    .getIconURL();

  Assert.equal(
    searchModeSwitcherIconUrl[1],
    defaultSearchEngineIconUrl,
    "The search mode switcher should have the same icon as the default search engine"
  );

  await Services.search.setDefault(
    defaultEngine,
    Ci.nsISearchService.CHANGE_REASON_UNKNOWN
  );
  await BrowserTestUtils.closeWindow(newWin);
});

add_task(async function test_search_icon_change_without_keyword_enabled() {
  await SpecialPowers.pushPrefEnv({
    set: [["keyword.enabled", false]],
  });

  let newWin = await BrowserTestUtils.openNewBrowserWindow();
  let searchModeSwitcherButton = newWin.document.getElementById(
    "searchmode-switcher-icon"
  );

  let regex = /url\("([^"]+)"\)/;
  let searchModeSwitcherIconUrl =
    searchModeSwitcherButton.style.listStyleImage.match(regex);

  const searchGlassIconUrl = UrlbarUtils.ICON.SEARCH_GLASS;

  Assert.equal(
    searchModeSwitcherIconUrl[1],
    searchGlassIconUrl,
    "The search mode switcher should have the search glass icon url since \
     keyword.enabled is false and we are not in search mode."
  );

  let popup = UrlbarTestUtils.searchModeSwitcherPopup(newWin);
  let engineName = "Bing";
  info("Open the urlbar and searchmode switcher popup");
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window: newWin,
    value: "",
  });
  await UrlbarTestUtils.openSearchModeSwitcher(newWin);
  info("Press on the bing menu button and enter search mode");
  let popupHidden = UrlbarTestUtils.searchModeSwitcherPopupClosed(newWin);
  popup.querySelector(`toolbarbutton[label=${engineName}]`).click();
  await popupHidden;

  const bingSearchEngineIconUrl = await Services.search
    .getEngineByName(engineName)
    .getIconURL();

  searchModeSwitcherIconUrl =
    searchModeSwitcherButton.style.listStyleImage.match(regex);

  Assert.equal(
    searchModeSwitcherIconUrl[1],
    bingSearchEngineIconUrl,
    "The search mode switcher should have the bing icon url since we are in \
     search mode"
  );
  await UrlbarTestUtils.assertSearchMode(newWin, {
    engineName: "Bing",
    entry: "searchbutton",
    source: 3,
  });

  info("Press the close button and exit search mode");
  newWin.document.querySelector("#searchmode-switcher-close").click();
  await UrlbarTestUtils.assertSearchMode(newWin, null);

  searchModeSwitcherIconUrl = await BrowserTestUtils.waitForCondition(
    () => searchModeSwitcherButton.style.listStyleImage.match(regex),
    "Waiting for the search mode switcher icon to update after exiting search mode."
  );

  Assert.equal(
    searchModeSwitcherIconUrl[1],
    searchGlassIconUrl,
    "The search mode switcher should have the search glass icon url since \
     keyword.enabled is false"
  );

  await BrowserTestUtils.closeWindow(newWin);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_suggestions_after_no_search_mode() {
  info("Add a search engine as default");
  let defaultEngine = await SearchTestUtils.installSearchExtension(
    {
      name: "default-engine",
      search_url: "https://www.example.com/",
      favicon_url: "https://www.example.com/favicon.ico",
    },
    {
      setAsDefault: true,
      skipUnload: true,
    }
  );

  info("Add one more search engine to check the result");
  let anotherEngine = await SearchTestUtils.installSearchExtension(
    {
      name: "another-engine",
      search_url: "https://example.com/",
      favicon_url: "https://example.com/favicon.ico",
    },
    { skipUnload: true }
  );

  info("Open urlbar with a query");
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    value: "test",
  });
  Assert.equal(
    (await UrlbarTestUtils.getDetailsOfResultAt(window, 0)).result.payload
      .engine,
    "default-engine",
    "Suggest to search from the default engine"
  );

  info("Open search mode swither");
  let popup = await UrlbarTestUtils.openSearchModeSwitcher(window);

  info("Press on the another-engine menu button");
  let popupHidden = UrlbarTestUtils.searchModeSwitcherPopupClosed(window);
  popup.querySelector("toolbarbutton[label=another-engine]").click();
  await popupHidden;
  Assert.equal(
    (await UrlbarTestUtils.getDetailsOfResultAt(window, 0)).result.payload
      .engine,
    "another-engine",
    "Suggest to search from the another engine"
  );

  info("Press the close button and escape search mode");
  window.document.querySelector("#searchmode-switcher-close").click();
  await UrlbarTestUtils.assertSearchMode(window, null);
  Assert.equal(
    (await UrlbarTestUtils.getDetailsOfResultAt(window, 0)).result.payload
      .engine,
    "default-engine",
    "Suggest to search from the default engine again"
  );

  await defaultEngine.unload();
  await anotherEngine.unload();
});

add_task(async function open_engine_page_directly() {
  await SearchTestUtils.installSearchExtension(
    {
      name: "MozSearch",
      search_url: "https://example.com/",
      favicon_url: "https://example.com/favicon.ico",
    },
    { setAsDefault: true }
  );

  const TEST_DATA = [
    {
      action: "click",
      input: "",
      expected: "https://example.com/",
    },
    {
      action: "click",
      input: "a b c",
      expected: "https://example.com/?q=a+b+c",
    },
    {
      action: "key",
      input: "",
      expected: "https://example.com/",
    },
    {
      action: "key",
      input: "a b c",
      expected: "https://example.com/?q=a+b+c",
    },
  ];

  for (let { action, input, expected } of TEST_DATA) {
    info(`Test for ${JSON.stringify({ action, input, expected })}`);

    info("Open a window");
    let newWin = await BrowserTestUtils.openNewBrowserWindow();

    info(`Open the result popup with [${input}]`);
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window: newWin,
      value: input,
    });

    info("Open the mode switcher");
    let popup = await UrlbarTestUtils.openSearchModeSwitcher(newWin);

    info(`Do action of [${action}] on MozSearch menuitem`);
    let popupHidden = UrlbarTestUtils.searchModeSwitcherPopupClosed(newWin);
    let pageLoaded = BrowserTestUtils.browserLoaded(
      newWin.gBrowser.selectedBrowser,
      false,
      expected
    );

    if (action == "click") {
      EventUtils.synthesizeMouseAtCenter(
        popup.querySelector("toolbarbutton[label=MozSearch]"),
        {
          shiftKey: true,
        },
        newWin
      );
    } else {
      popup.querySelector("toolbarbutton[label=MozSearch]").focus();
      EventUtils.synthesizeKey("KEY_Enter", { shiftKey: true }, newWin);
    }

    await popupHidden;
    await pageLoaded;
    Assert.ok(true, "The popup was hidden and expected page was loaded");

    info("Search mode also be changed");
    await UrlbarTestUtils.assertSearchMode(newWin, {
      engineName: "MozSearch",
      isGeneralPurposeEngine: false,
      isPreview: true,
      entry: "searchbutton",
    });

    // Cleanup.
    await PlacesUtils.history.clear();
    await BrowserTestUtils.closeWindow(newWin);
  }
});

add_task(async function test_enter_searchmode_by_key_if_single_result() {
  await PlacesTestUtils.addBookmarkWithDetails({
    uri: "https://example.com/",
    title: "BOOKMARK",
  });

  const TEST_DATA = [
    {
      key: "KEY_Enter",
      expectedEntry: "keywordoffer",
    },
    {
      key: "KEY_Tab",
      expectedEntry: "keywordoffer",
    },
    {
      key: "VK_RIGHT",
      expectedEntry: "typed",
    },
    {
      key: "VK_DOWN",
      expectedEntry: "keywordoffer",
    },
  ];
  for (let { key, expectedEntry } of TEST_DATA) {
    info(`Test for entering search mode by ${key}`);

    info("Open urlbar with a query that shows bookmarks");
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      value: "@book",
    });

    // Sanity check.
    const autofill = await UrlbarTestUtils.getDetailsOfResultAt(window, 0);
    Assert.equal(autofill.result.providerName, "RestrictKeywordsAutofill");
    Assert.equal(autofill.result.payload.autofillKeyword, "@bookmarks");

    info("Choose the search mode suggestion");
    EventUtils.synthesizeKey(key, {});
    await UrlbarTestUtils.promiseSearchComplete(window);
    await UrlbarTestUtils.assertSearchMode(window, {
      source: UrlbarUtils.RESULT_SOURCE.BOOKMARKS,
      entry: expectedEntry,
      restrictType: "keyword",
    });

    info("Check the suggestions");
    Assert.equal(UrlbarTestUtils.getResultCount(window), 1);
    const bookmark = await UrlbarTestUtils.getDetailsOfResultAt(window, 0);
    Assert.equal(bookmark.result.source, UrlbarUtils.RESULT_SOURCE.BOOKMARKS);
    Assert.equal(bookmark.result.type, UrlbarUtils.RESULT_TYPE.URL);
    Assert.equal(bookmark.result.payload.url, "https://example.com/");
    Assert.equal(bookmark.result.payload.title, "BOOKMARK");

    info("Choose any search engine from the switcher");
    let popup = await UrlbarTestUtils.openSearchModeSwitcher(window);
    let popupHidden = UrlbarTestUtils.searchModeSwitcherPopupClosed(window);
    popup.querySelector("toolbarbutton[label=Bing]").click();
    await popupHidden;
    Assert.equal(gURLBar.value, "", "The value of urlbar should be empty");

    // Clean up.
    window.document.querySelector("#searchmode-switcher-close").click();
    await UrlbarTestUtils.assertSearchMode(window, null);
  }

  await PlacesUtils.bookmarks.eraseEverything();
});

add_task(
  async function test_enter_searchmode_as_preview_by_key_if_multiple_results() {
    await PlacesTestUtils.addBookmarkWithDetails({
      uri: "https://example.com/",
      title: "BOOKMARK",
    });

    for (let key of ["KEY_Tab", "VK_DOWN"]) {
      info(`Test for entering search mode by ${key}`);

      info("Open urlbar with a query that shows bookmarks");
      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window,
        value: "@",
      });

      info("Choose the bookmark search mode");
      let resultCount = UrlbarTestUtils.getResultCount(window);
      for (let i = 0; i < resultCount; i++) {
        EventUtils.synthesizeKey(key, {});

        let { result } = await UrlbarTestUtils.getDetailsOfResultAt(window, i);
        if (
          result.providerName == "RestrictKeywords" &&
          result.payload.keyword == "*"
        ) {
          await UrlbarTestUtils.assertSearchMode(window, {
            source: UrlbarUtils.RESULT_SOURCE.BOOKMARKS,
            entry: "keywordoffer",
            restrictType: "keyword",
            isPreview: true,
          });
          break;
        }
      }

      // Clean up.
      window.document.querySelector("#searchmode-switcher-close").click();
      await UrlbarTestUtils.assertSearchMode(window, null);
    }

    await PlacesUtils.bookmarks.eraseEverything();
  }
);

add_task(async function test_open_state() {
  let popup = UrlbarTestUtils.searchModeSwitcherPopup(window);
  let switcher = document.getElementById("urlbar-searchmode-switcher");

  for (let target of [
    "urlbar-searchmode-switcher",
    "searchmode-switcher-icon",
    "searchmode-switcher-dropmarker",
  ]) {
    info(`Open search mode switcher popup by clicking on [${target}]`);
    let popupOpen = BrowserTestUtils.waitForEvent(popup, "popupshown");
    let button = document.getElementById(target);
    button.click();
    await popupOpen;
    Assert.equal(
      switcher.getAttribute("open"),
      "true",
      "The 'open' attribute should be true"
    );

    info("Close the popup");
    popup.hidePopup();
    await TestUtils.waitForCondition(() => {
      return !switcher.hasAttribute("open");
    });
    Assert.ok(true, "The 'open' attribute should not be set");
  }
});

add_task(async function test_focus_on_switcher_by_tab() {
  for (const input of ["", "abc"]) {
    info(`Open urlbar view with query [${input}]`);
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      value: input,
    });

    if (input) {
      info("Focus on input field by tab");
      EventUtils.synthesizeKey("KEY_Tab", { shiftKey: true });
    }

    info("Focus on Dedicated Search by tab");
    EventUtils.synthesizeKey("KEY_Tab", { shiftKey: true });

    await TestUtils.waitForCondition(
      () => document.activeElement.id == "urlbar-searchmode-switcher"
    );
    Assert.ok(true, "Dedicated Search button gets the focus");
    let popup = UrlbarTestUtils.searchModeSwitcherPopup(window);
    Assert.equal(popup.state, "closed", "Switcher popup should not be opened");
    Assert.ok(gURLBar.view.isOpen, "Urlbar view panel has been opening");
    Assert.equal(gURLBar.value, input, "Inputted value still be on urlbar");

    info("Open the switcher popup by key");
    let promiseMenuOpen = BrowserTestUtils.waitForEvent(popup, "popupshown");
    EventUtils.synthesizeKey("KEY_Enter");
    await promiseMenuOpen;
    Assert.notEqual(
      document.activeElement.id,
      "urlbar-searchmode-switcher",
      "Dedicated Search button loses the focus"
    );
    Assert.equal(
      gURLBar.view.panel.hasAttribute("hide-temporarily"),
      true,
      "Urlbar view panel is closed"
    );
    Assert.equal(gURLBar.value, input, "Inputted value still be on urlbar");

    info("Close the switcher popup by Escape");
    let promiseMenuClose = BrowserTestUtils.waitForEvent(popup, "popuphidden");
    EventUtils.synthesizeKey("KEY_Escape");
    await promiseMenuClose;
    Assert.equal(
      document.activeElement.id,
      "urlbar-input",
      "Urlbar gets the focus"
    );
    Assert.equal(
      gURLBar.view.panel.hasAttribute("hide-temporarily"),
      false,
      "Urlbar view panel is opened"
    );
    Assert.equal(gURLBar.value, input, "Inputted value still be on urlbar");
  }
});

add_task(async function test_focus_order_by_tab() {
  await PlacesTestUtils.addBookmarkWithDetails({
    uri: "https://example.com/",
    title: "abc",
  });

  const FOCUS_ORDER_ASSERTIONS = [
    () =>
      Assert.equal(
        gURLBar.view.selectedElement,
        gURLBar.view.getLastSelectableElement()
      ),
    () =>
      Assert.equal(
        document.activeElement,
        document.getElementById("urlbar-searchmode-switcher")
      ),
    () => Assert.equal(document.activeElement, gURLBar.inputField),
    () =>
      Assert.equal(
        gURLBar.view.selectedElement,
        gURLBar.view.getFirstSelectableElement()
      ),
    () =>
      Assert.equal(
        gURLBar.view.selectedElement,
        gURLBar.view.getLastSelectableElement()
      ),
    () =>
      Assert.equal(
        document.activeElement,
        document.getElementById("urlbar-searchmode-switcher")
      ),
    () => Assert.equal(document.activeElement, gURLBar.inputField),
  ];

  for (const shiftKey of [false, true]) {
    info("Open urlbar view");
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      value: "abc",
    });
    Assert.equal(document.activeElement, gURLBar.inputField);
    Assert.equal(
      gURLBar.view.selectedElement,
      gURLBar.view.getFirstSelectableElement()
    );

    let resultCount = UrlbarTestUtils.getResultCount(window);
    Assert.equal(resultCount, 2, "This test needs exact 2 results");

    for (const assert of shiftKey
      ? [...FOCUS_ORDER_ASSERTIONS].reverse()
      : FOCUS_ORDER_ASSERTIONS) {
      EventUtils.synthesizeKey("KEY_Tab", { shiftKey });
      assert();
    }
  }

  await PlacesUtils.bookmarks.eraseEverything();
});

add_task(async function nimbusScotchBonnetEnableOverride() {
  info("Setup initial local pref");
  let defaultBranch = Services.prefs.getDefaultBranch("browser.urlbar.");
  let initialValue = defaultBranch.getBoolPref("scotchBonnet.enableOverride");
  defaultBranch.setBoolPref("scotchBonnet.enableOverride", false);
  UrlbarPrefs.clear("scotchBonnet.enableOverride");

  await TestUtils.waitForCondition(() => {
    return BrowserTestUtils.isHidden(
      gURLBar.querySelector("#urlbar-searchmode-switcher")
    );
  });
  Assert.ok(true, "Search mode switcher should be hidden");

  info("Setup Numbus value");
  const cleanUpNimbusEnable = await UrlbarTestUtils.initNimbusFeature(
    { scotchBonnetEnableOverride: true },
    "search"
  );
  await TestUtils.waitForCondition(() => {
    return BrowserTestUtils.isVisible(
      gURLBar.querySelector("#urlbar-searchmode-switcher")
    );
  });
  Assert.ok(true, "Search mode switcher should be visible");

  await cleanUpNimbusEnable();
  defaultBranch.setBoolPref("scotchBonnet.enableOverride", initialValue);
  await SpecialPowers.pushPrefEnv({
    set: [["browser.urlbar.scotchBonnet.enableOverride", true]],
  });
});

add_task(async function nimbusLogEnabled() {
  info("Setup initial local pref");
  await SpecialPowers.pushPrefEnv({
    set: [["browser.search.log", false]],
  });
  await TestUtils.waitForCondition(() => {
    return !Services.prefs.getBoolPref("browser.search.log");
  });

  info("Setup Numbus value");
  const cleanUpNimbusEnable = await UrlbarTestUtils.initNimbusFeature(
    { logEnabled: true },
    "search"
  );
  await TestUtils.waitForCondition(() => {
    return Services.prefs.getBoolPref("browser.search.log");
  });
  Assert.ok(true, "browser.search.log is changed properly");

  await cleanUpNimbusEnable();
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_button_stuck() {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  let popup = win.document.getElementById("searchmode-switcher-popup");
  let button = win.document.getElementById("urlbar-searchmode-switcher");

  info("Show the SearchModeSwitcher");
  let promiseMenuOpen = BrowserTestUtils.waitForEvent(popup, "popupshown");
  EventUtils.synthesizeMouseAtCenter(button, {}, win);
  await promiseMenuOpen;

  info("Hide the SearchModeSwitcher");
  let promiseMenuClosed = BrowserTestUtils.waitForEvent(popup, "popuphidden");
  EventUtils.synthesizeMouseAtCenter(button, {}, win);
  await promiseMenuClosed;
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_readonly() {
  let popupOpened = BrowserTestUtils.waitForNewWindow({ url: "about:blank" });
  BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "data:text/html,<html><script>popup=open('about:blank','','width=300,height=200')</script>"
  );
  let win = await popupOpened;

  Assert.ok(win.gURLBar, "location bar exists in the popup");
  Assert.ok(win.gURLBar.readOnly, "location bar is read-only in the popup");

  Assert.equal(
    BrowserTestUtils.isVisible(
      win.gURLBar.querySelector("#urlbar-searchmode-switcher")
    ),
    false,
    "Unified Search Button should not be visible in readonly windows"
  );

  let closedPopupPromise = BrowserTestUtils.windowClosed(win);
  win.close();
  await closedPopupPromise;
  gBrowser.removeCurrentTab();
});

add_task(async function test_search_service_fail() {
  let newWin = await BrowserTestUtils.openNewBrowserWindow();

  const stub = sinon
    .stub(UrlbarSearchUtils, "init")
    .rejects(new Error("Initialization failed"));

  Services.search.wrappedJSObject.forceInitializationStatusForTests(
    "not initialized"
  );

  // Force updateSearchIcon to be triggered
  await SpecialPowers.pushPrefEnv({
    set: [["keyword.enabled", false]],
  });

  let searchModeSwitcherButton = newWin.document.getElementById(
    "searchmode-switcher-icon"
  );

  const searchGlassIconUrl = UrlbarUtils.ICON.SEARCH_GLASS;

  // match and capture the URL inside `url("...")`
  let regex = /url\("([^"]+)"\)/;
  let searchModeSwitcherIconUrl = await BrowserTestUtils.waitForCondition(
    () => searchModeSwitcherButton.style.listStyleImage.match(regex),
    "Waiting for the search mode switcher icon to update after exiting search mode."
  );

  Assert.equal(
    searchModeSwitcherIconUrl[1],
    searchGlassIconUrl,
    "The search mode switcher should have the search glass icon url since the search service init failed."
  );

  info("Open search mode switcher");
  let popup = await UrlbarTestUtils.openSearchModeSwitcher(newWin);

  info("Ensure local search modes are present in popup");
  let localSearchModes = ["bookmarks", "history", "tabs"];
  for (let searchMode of localSearchModes) {
    popup.querySelector(`#search-button-${searchMode}`);
    Assert.ok("Local search modes should be present");
  }

  let localSearchButton = popup.querySelector(
    `#search-button-${localSearchModes[0]}`
  );

  let popupHidden = BrowserTestUtils.waitForEvent(popup, "popuphidden");
  localSearchButton.click();
  await popupHidden;

  stub.restore();

  Services.search.wrappedJSObject.forceInitializationStatusForTests("success");

  await BrowserTestUtils.closeWindow(newWin);
});

add_task(async function test_search_mode_switcher_engine_no_icon() {
  const testEngineName = "TestEngineNoIcon";
  let searchExtension = await SearchTestUtils.installSearchExtension(
    {
      name: testEngineName,
      search_url: "https://www.example.com/search?q=",
      favicon_url: "",
    },
    { skipUnload: true }
  );

  let searchModeSwitcherButton = window.document.getElementById(
    "searchmode-switcher-icon"
  );

  let popup = await UrlbarTestUtils.openSearchModeSwitcher(window);

  popup.querySelector(`toolbarbutton[label=${testEngineName}]`).click();

  let regex = /url\("([^"]+)"\)/;
  let searchModeSwitcherIconUrl = await BrowserTestUtils.waitForCondition(
    () => searchModeSwitcherButton.style.listStyleImage.match(regex),
    "Waiting for the search mode switcher icon to update."
  );

  const searchGlassIconUrl = UrlbarUtils.ICON.SEARCH_GLASS;

  Assert.equal(
    searchModeSwitcherIconUrl[1],
    searchGlassIconUrl,
    "The search mode switcher should display the default search glass icon when the engine has no icon."
  );

  await searchExtension.unload();
});
