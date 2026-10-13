var searchStyle = class extends ExtensionCommon.ExtensionAPI {
  onStartup() {
    this.documents = new Map();
    this.pending = new Map();
    this.styles = Cc["@mozilla.org/content/style-sheet-service;1"].getService(
      Ci.nsIStyleSheetService
    );
    this.uri = Services.io.newURI("search-results.css", null, this.extension.rootURI);
    this.styles.loadAndRegisterSheet(this.uri, this.styles.USER_SHEET);
    Services.obs.addObserver(this, "document-element-inserted");
    for (const win of Services.wm.getEnumerator("mail:3pane")) {
      for (const tab of win.document.getElementById("tabmail").tabInfo) {
        this.observe(tab.browser?.contentDocument);
      }
    }
  }

  observe(doc) {
    if (
      doc?.documentURI !== "chrome://messenger/content/glodaFacetView.xhtml" ||
      this.documents.has(doc) || this.pending.has(doc)
    ) {
      return;
    }
    if (doc.readyState !== "complete") {
      const win = doc.defaultView;
      const cancel = () => {
        win.removeEventListener("load", ready);
        win.removeEventListener("unload", cancel);
        this.pending.delete(doc);
      };
      const ready = () => {
        cancel();
        this.attach(doc);
      };
      this.pending.set(doc, cancel);
      win.addEventListener("load", ready, { once: true });
      win.addEventListener("unload", cancel, { once: true });
    } else {
      this.attach(doc);
    }
  }

  attach(doc) {
    const win = doc.defaultView;
    const layout = doc.getElementById("gloda-facet-view");
    const messages = doc.querySelector(".messages");
    if (!layout || !messages) {
      return;
    }
    const tabmail = win.top.document.getElementById("tabmail");
    const pane = doc.createElement("section");
    pane.id = "thwunder-preview";
    pane.setAttribute("aria-label", "Message preview");
    const status = doc.createElement("p");
    status.id = "thwunder-preview-status";
    status.setAttribute("role", "status");
    status.textContent = "Select a message to preview";
    pane.append(status);
    layout.append(pane);
    layout.setAttribute("data-thwunder-preview", "true");

    let selected = null;
    let browser = null;
    let ready = false;
    const originals = new WeakMap();
    const formatter = new Intl.ListFormat(Services.locale.appLocaleAsBCP47);

    const updateRows = () => {
      for (const row of messages.children) {
        const recipients = row.querySelector(".message-recipients");
        const group = row.querySelector(".message-recipients-group");
        if (!recipients || !group || originals.has(row)) {
          continue;
        }
        originals.set(row, {
          children: [...recipients.childNodes],
          title: group.getAttribute("title"),
          hidden: group.hidden,
        });
        // Gloda recipients are identities: the name is on contact, not identity.
        const identities = row.message.to ?? row.message.recipients ?? [];
        const names = identities.map(identity =>
          identity.contact?.name?.trim() || identity.value || identity.name
        ).filter(name => typeof name === "string" && name.trim());
        recipients.textContent = formatter.format(names);
        group.title = identities.map(identity => identity.value || identity.contact?.name || identity.name)
          .filter(Boolean).join(", ");
        group.hidden = names.length === 0;
      }
      if (selected && !messages.contains(selected)) {
        selected.removeAttribute("data-thwunder-selected");
        selected.querySelector(".message-subject").removeAttribute("aria-current");
        selected = null;
        showStatus("Select a message to preview");
      }
    };

    const showStatus = text => {
      if (browser) {
        browser.hidden = true;
      }
      status.textContent = text;
      status.hidden = false;
      if (ready) {
        try {
          browser.contentWindow.displayMessage();
        } catch (error) {
          console.error("ThwunderSearch: could not clear preview", error);
        }
      }
    };

    const displaySelected = () => {
      if (!selected || !messages.contains(selected) || !ready) {
        return;
      }
      try {
        const uri = selected.message.folderMessageURI;
        if (!uri) {
          showStatus("This message is no longer available in its folder.");
          return;
        }
        const view = browser.contentWindow;
        view.tabOrWindow = win.FacetContext.tab;
        browser.hidden = false;
        status.hidden = true;
        view.displayMessage(uri);
      } catch (error) {
        console.error("ThwunderSearch: could not preview message", error);
        showStatus("Unable to preview this message. Double-click the result to open it in a tab.");
      }
    };

    const onBrowserLoad = event => {
      if (event.target !== browser.contentDocument || browser.currentURI.spec !== "about:message") {
        return;
      }
      ready = true;
      browser.removeEventListener("load", onBrowserLoad, true);
      displaySelected();
    };

    const select = row => {
      selected?.removeAttribute("data-thwunder-selected");
      selected?.querySelector(".message-subject").removeAttribute("aria-current");
      selected = row;
      row.setAttribute("data-thwunder-selected", "true");
      row.querySelector(".message-subject").setAttribute("aria-current", "true");
      row.querySelector(".message-subject").focus({ preventScroll: true });
      if (!browser) {
        status.textContent = "Loading message…";
        // Embed Thunderbird's sandboxed viewer, never message HTML in this document.
        browser = doc.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "browser");
        browser.id = "thwunder-message-browser";
        browser.setAttribute("aria-label", "Message content");
        browser.hidden = true;
        browser.addEventListener("load", onBrowserLoad, true);
        browser.setAttribute("src", "about:message");
        pane.append(browser);
      } else {
        displaySelected();
      }
    };

    const onClick = event => {
      const row = event.target.closest(".message");
      if (!row || event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.type === "dblclick" || event.ctrlKey || event.metaKey || event.shiftKey) {
        win.FacetContext.showConversationInTab(row, event.ctrlKey || event.metaKey);
      } else {
        select(row);
      }
    };

    const onKey = event => {
      let row = event.target.closest(".message");
      if (!row || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (!["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.type === "keypress") {
        return;
      }
      if (event.key === "ArrowDown") {
        row = row.nextElementSibling || row;
      } else if (event.key === "ArrowUp") {
        row = row.previousElementSibling || row;
      }
      select(row);
      row.scrollIntoView({ block: "nearest" });
    };

    const onTabSelect = () => {
      if (!ready || !selected) {
        return;
      }
      const view = browser.contentWindow;
      view.getMessagePaneBrowser().docShellIsActive = win.FacetContext.tab.selected && !browser.hidden;
      if (!win.FacetContext.tab.selected) {
        view.ClearPendingReadTimer();
      }
    };

    // Native header buttons dispatch via the selected tab's command controller.
    const controllerFor = (command, tab) => {
      if (tab !== win.FacetContext.tab || !ready || browser.hidden) {
        return null;
      }
      const controller = browser.contentWindow.commandController;
      return controller.supportsCommand(command) ? controller : null;
    };
    const monitor = {
      onTabSwitched: onTabSelect,
      onTabOpened() {},
      onTabTitleChanged() {},
      supportsCommand: (command, tab) => controllerFor(command, tab) ? true : null,
      isCommandEnabled: (command, tab) => controllerFor(command, tab)?.isCommandEnabled(command) ?? null,
      doCommand(command, tab) {
        const controller = controllerFor(command, tab);
        if (!controller) {
          return null;
        }
        if (controller.isCommandEnabled(command)) {
          controller.doCommand(command);
        }
        return true;
      },
    };
    tabmail.registerTabMonitor(monitor);

    const observer = new win.MutationObserver(updateRows);
    observer.observe(messages, { childList: true });
    messages.addEventListener("click", onClick, true);
    messages.addEventListener("dblclick", onClick, true);
    messages.addEventListener("keydown", onKey, true);
    messages.addEventListener("keypress", onKey, true);

    const cleanup = () => {
      observer.disconnect();
      messages.removeEventListener("click", onClick, true);
      messages.removeEventListener("dblclick", onClick, true);
      messages.removeEventListener("keydown", onKey, true);
      messages.removeEventListener("keypress", onKey, true);
      tabmail.unregisterTabMonitor(monitor);
      win.removeEventListener("unload", cleanup);
      selected?.removeAttribute("data-thwunder-selected");
      selected?.querySelector(".message-subject").removeAttribute("aria-current");
      browser?.removeEventListener("load", onBrowserLoad, true);
      browser?.contentWindow?.ClearPendingReadTimer?.();
      pane.remove();
      layout.removeAttribute("data-thwunder-preview");
      for (const row of messages.children) {
        const original = originals.get(row);
        if (!original) {
          continue;
        }
        row.querySelector(".message-recipients").replaceChildren(...original.children);
        const group = row.querySelector(".message-recipients-group");
        group.hidden = original.hidden;
        if (original.title === null) {
          group.removeAttribute("title");
        } else {
          group.setAttribute("title", original.title);
        }
      }
      this.documents.delete(doc);
    };
    this.documents.set(doc, cleanup);
    win.addEventListener("unload", cleanup, { once: true });
    updateRows();
  }

  onShutdown() {
    Services.obs.removeObserver(this, "document-element-inserted");
    for (const cancel of this.pending.values()) {
      cancel();
    }
    this.pending.clear();
    for (const cleanup of this.documents.values()) {
      cleanup();
    }
    if (this.styles?.sheetRegistered(this.uri, this.styles.USER_SHEET)) {
      this.styles.unregisterSheet(this.uri, this.styles.USER_SHEET);
    }
  }
};
