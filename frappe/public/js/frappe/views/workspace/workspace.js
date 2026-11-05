import EditorJS from "@editorjs/editorjs";
import Undo from "editorjs-undo";

const ONERP_MODULES = {
	accounting: {
		icon: "es-line-book",
		color: "#0f6fbd",
		description: __("Automate your bills, bank transactions and accounting processes."),
	},
	payables: {
		icon: "es-line-payments",
		color: "#d97706",
		description: __("Track vendor bills, payments and outstanding dues."),
	},
	receivables: {
		icon: "es-line-payments",
		color: "#059669",
		description: __("Manage customer invoices, receipts and ageing."),
	},
	"financial-reports": {
		icon: "es-line-reports",
		color: "#0d9488",
		description: __("P&L, balance sheet, cash flow and statutory reports."),
	},
	buying: {
		icon: "es-line-inbox",
		color: "#7c3aed",
		description: __("Raise purchase orders, receive goods and control vendor bills."),
	},
	selling: {
		icon: "es-line-tag",
		color: "#db2777",
		description: __("Create quotations, manage orders and track customer invoices."),
	},
	stock: {
		icon: "es-line-storage",
		color: "#0891b2",
		description: __("Track stock levels, warehouses and product movements."),
	},
	assets: {
		icon: "es-line-laptop",
		color: "#4f46e5",
		description: __("Manage fixed asset lifecycle, depreciation and disposal."),
	},
	manufacturing: {
		icon: "es-line-plan",
		color: "#ea580c",
		description: __("BOMs, production orders, work centers and shop-floor control."),
	},
	quality: {
		icon: "es-line-certificates",
		color: "#16a34a",
		description: __("Define quality inspections and drive continuous improvement."),
	},
	projects: {
		icon: "es-line-progress",
		color: "#8b5cf6",
		description: __("Plan projects, tasks and timesheets end to end."),
	},
	support: {
		icon: "es-line-support",
		color: "#dc2626",
		description: __("Raise support tickets and resolve customer issues."),
	},
	users: {
		icon: "es-line-people",
		color: "#2563eb",
		description: __("Invite team members and control access across your company."),
	},
	website: {
		icon: "es-line-globe",
		color: "#0284c7",
		description: __("Build and manage your public website and portal."),
	},
	crm: {
		icon: "es-line-customer",
		color: "#e11d48",
		description: __("Manage leads, opportunities and customer relationships."),
	},
	tools: {
		icon: "es-line-settings",
		color: "#475569",
		description: __("Automations, integrations and power tools."),
	},
	"erpnext-settings": {
		icon: "es-line-settings",
		color: "#64748b",
		description: __("Configure company, accounting and system preferences."),
	},
	integrations: {
		icon: "es-line-web-link",
		color: "#9333ea",
		description: __("Connect payments, shipping and third-party services."),
	},
	"erpnext-integrations": {
		icon: "es-line-link",
		color: "#6d28d9",
		description: __("ERPNext cloud integrations and connectors."),
	},
	build: {
		icon: "es-line-code",
		color: "#334155",
		description: __("Frappe framework apps and developer tools."),
	},
};

// Permission level 1 already hides roles/modules/API keys for a tenant; these are the
// permlevel-0 account controls a tenant must not toggle on themselves -- disabling your
// own user or changing session/IP limits is an admin action, not a profile edit.
const ONERP_PROFILE_LOCKED_FIELDS = [
	"enabled",
	"send_welcome_email",
	"simultaneous_sessions",
	"restrict_ip",
	"bypass_restrict_ip_check_if_2fa_enabled",
	"login_after",
	"login_before",
	"last_login",
	"last_ip",
	"last_active",
	"module_profile",
	"role_profile_name",
];

frappe.standard_pages["Workspaces"] = function () {
	var wrapper = frappe.container.add_page("Workspaces");

	frappe.ui.make_app_page({
		parent: wrapper,
		name: "Workspaces",
		title: __("Workspace"),
	});

	frappe.workspace = new frappe.views.Workspace(wrapper);
	$(wrapper).bind("show", function () {
		frappe.workspace.show();
	});
};

frappe.views.Workspace = class Workspace {
	constructor(wrapper) {
		this.wrapper = $(wrapper);
		this.page = wrapper.page;
		this.blocks = frappe.workspace_block.blocks;
		this.is_read_only = true;
		this.pages = {};
		this.sorted_public_items = [];
		this.sorted_private_items = [];
		this.current_page = {};
		this.sidebar_items = {
			public: {},
			private: {},
		};
		this.sidebar_categories = [
			{ id: "Personal", label: __("Personal", null, "Workspace Category") },
			{ id: "Public", label: __("Public", null, "Workspace Category") },
		];
		this.indicator_colors = [
			"green",
			"cyan",
			"blue",
			"orange",
			"yellow",
			"gray",
			"grey",
			"red",
			"pink",
			"darkgrey",
			"purple",
			"light-blue",
		];

		this.prepare_container();
		this.setup_pages();
		this.register_awesomebar_shortcut();
	}

	prepare_container() {
		let list_sidebar = $(`
			<div class="list-sidebar overlay-sidebar hidden-xs hidden-sm">
				<div class="desk-sidebar list-unstyled sidebar-menu"></div>
			</div>
		`).appendTo(this.wrapper.find(".layout-side-section"));
		this.sidebar = list_sidebar.find(".desk-sidebar");
		this.body = this.wrapper.find(".layout-main-section");
		this.prepare_new_and_edit();
	}

	async setup_pages(reload) {
		!this.discard && this.create_page_skeleton();
		// The rail is built here but only hidden by show_home_dashboard in a later tick,
		// which paints it for a moment on every reload of the main dashboard.
		if (this.is_home_route()) this.hide_workspace_sidebar();
		!this.discard && this.create_sidebar_skeleton();
		this.sidebar_pages = !this.discard ? await this.get_pages() : this.sidebar_pages;
		this.cached_pages = $.extend(true, {}, this.sidebar_pages);
		this.all_pages = this.sidebar_pages.pages;
		this.has_access = this.sidebar_pages.has_access;
		this.has_create_access = this.sidebar_pages.has_create_access;

		this.all_pages.forEach((page) => {
			page.is_editable = !page.public || this.has_access;
		});

		this.public_pages = this.all_pages.filter((page) => page.public);
		this.private_pages = this.all_pages.filter((page) => !page.public);

		if (this.all_pages) {
			frappe.workspaces = {};
			for (let page of this.all_pages) {
				frappe.workspaces[frappe.router.slug(page.name)] = {
					title: page.title,
					public: page.public,
				};
			}
			this.make_sidebar();
			reload && this.show();
		}
	}

	prepare_new_and_edit() {
		this.$page = $(`
		<div class="editor-js-container"></div>
		<div class="workspace-footer">
			<button data-label="New" class="btn btn-default ellipsis btn-new-workspace">
				<svg class="es-icon es-line icon-xs" style="" aria-hidden="true">
					<use class="" href="#es-line-add"></use>
				</svg>
				<span class="hidden-xs" data-label="New">${__("New")}</span>
			</button>
			<button class="btn btn-default btn-sm mr-2 btn-edit-workspace" data-label="Edit">
				<svg class="es-icon es-line  icon-xs" style="" aria-hidden="true">
					<use class="" href="#es-line-edit"></use>
				</svg>
				<span class="hidden-xs" data-label="Edit">${__("Edit")}</span>
			</button>
		</div>
	`).appendTo(this.body);

		this.body.find(".btn-new-workspace").on("click", () => {
			this.initialize_new_page(true);
		});

		this.body.find(".btn-edit-workspace").on("click", async () => {
			if (!this.editor || !this.editor.readOnly) return;
			this.is_read_only = false;
			this.toggle_hidden_workspaces(true);
			await this.editor.readOnly.toggle();
			this.editor.isReady.then(() => {
				this.body.addClass("edit-mode");
				this.initialize_editorjs_undo();
				this.setup_customization_buttons(this._page);
				this.show_sidebar_actions();
				this.make_blocks_sortable();
			});
		});
	}

	get_pages() {
		return frappe.xcall("frappe.desk.desktop.get_workspace_sidebar_items");
	}

	sidebar_item_container(item) {
		item.indicator_color =
			item.indicator_color || this.indicator_colors[Math.floor(Math.random() * 12)];

		return $(`
			<div
				class="sidebar-item-container ${item.is_editable ? "is-draggable" : ""}"
				item-parent="${item.parent_page}"
				item-name="${item.title}"
				item-public="${item.public || 0}"
				item-is-hidden="${item.is_hidden || 0}"
			>
				<div class="desk-sidebar-item standard-sidebar-item ${item.selected ? "selected" : ""}">
					<a
						href="/app/${
							item.public
								? frappe.router.slug(item.title)
								: "private/" + frappe.router.slug(item.title)
						}"
						class="item-anchor ${item.is_editable ? "" : "block-click"}" title="${__(item.title)}"
					>
						<span class="sidebar-item-icon" item-icon=${item.icon || "folder-normal"}>
							${
								item.public
									? frappe.utils.icon(item.icon || "folder-normal", "md")
									: `<span class="indicator ${item.indicator_color}"></span>`
							}
						</span>
						<span class="sidebar-item-label">${__(item.title)}<span>
					</a>
					<div class="sidebar-item-control"></div>
				</div>
				<div class="sidebar-child-item nested-container"></div>
			</div>
		`);
	}

	make_sidebar() {
		if (this.is_read_only && !this.is_home_page(this.get_page_to_show())) {
			this.make_onerp_module_sidebar(this.get_page_to_show());
			return;
		}

		if (this.sidebar.find(".standard-sidebar-section")[0]) {
			this.sidebar.find(".standard-sidebar-section").remove();
		}

		this.sidebar_categories.forEach((category) => {
			let root_pages = this.public_pages.filter(
				(page) => page.parent_page == "" || page.parent_page == null
			);
			if (category.id != "Public") {
				root_pages = this.private_pages.filter(
					(page) => page.parent_page == "" || page.parent_page == null
				);
			}
			root_pages = root_pages.uniqBy((d) => d.title);
			this.build_sidebar_section(category, root_pages);
		});

		// Scroll sidebar to selected page if it is not in viewport.
		this.sidebar.find(".selected").length &&
			!frappe.dom.is_element_in_viewport(this.sidebar.find(".selected")) &&
			this.sidebar.find(".selected")[0].scrollIntoView();

		this.remove_sidebar_skeleton();

		// Home resolves from the default workspace, not only the URL.
		if (this.is_home_page(this.get_page_to_show())) this.hide_workspace_sidebar();
	}

	build_sidebar_section(category, root_pages) {
		let sidebar_section = $(
			`<div class="standard-sidebar-section nested-container" data-title="${category.id}"></div>`
		);

		let $title = $(`<button class="btn-reset standard-sidebar-label">
			<span>${frappe.utils.icon("es-line-down", "xs")}</span>
			<span class="section-title">${category.label}<span>
		</div>`).appendTo(sidebar_section);
		$title.attr({
			"aria-label": __("Toggle Section: {0}", [category.label]),
			"aria-expanded": "true",
		});
		this.prepare_sidebar(root_pages, sidebar_section, this.sidebar);

		$title.on("click", (e) => {
			const $e = $(e.target);
			const href = $e.find("span use").attr("href");
			const isCollapsed = href === "#es-line-down";
			let icon = isCollapsed ? "#es-line-right-chevron" : "#es-line-down";
			$e.find("span use").attr("href", icon);
			$e.parent().find(".sidebar-item-container").toggleClass("hidden");
			$e.attr("aria-expanded", String(!isCollapsed));
		});

		if (Object.keys(root_pages).length === 0) {
			sidebar_section.addClass("hidden");
		}

		$(".item-anchor").on("click", () => {
			$(".list-sidebar.hidden-xs.hidden-sm").removeClass("opened");
			$(".close-sidebar").css("display", "none");
			$("body").css("overflow", "auto");
		});

		if (
			sidebar_section.find(".sidebar-item-container").length &&
			sidebar_section.find("> [item-is-hidden='0']").length == 0
		) {
			sidebar_section.addClass("hidden show-in-edit-mode");
		}
	}

	prepare_sidebar(items, child_container, item_container) {
		items.forEach((item) => this.append_item(item, child_container));
		child_container.appendTo(item_container);
	}

	append_item(item, container) {
		let is_current_page =
			frappe.router.slug(item.title) == frappe.router.slug(this.get_page_to_show().name) &&
			item.public == this.get_page_to_show().public;
		item.selected = is_current_page;
		if (is_current_page) {
			this.current_page = { name: item.title, public: item.public };
		}

		let $item_container = this.sidebar_item_container(item);
		let sidebar_control = $item_container.find(".sidebar-item-control");

		this.add_sidebar_actions(item, sidebar_control);
		let pages = item.public ? this.public_pages : this.private_pages;

		let child_items = pages.filter((page) => page.parent_page == item.title);
		if (child_items.length > 0) {
			let child_container = $item_container.find(".sidebar-child-item");
			child_container.addClass("hidden");
			this.prepare_sidebar(child_items, child_container, $item_container);
		}

		$item_container.appendTo(container);
		this.sidebar_items[item.public ? "public" : "private"][item.title] = $item_container;

		if ($item_container.parent().hasClass("hidden") && is_current_page) {
			$item_container.parent().toggleClass("hidden");
		}

		this.add_drop_icon(item, sidebar_control, $item_container);

		if (child_items.length > 0) {
			$item_container.find(".drop-icon").first().addClass("show-in-edit-mode");
		}
	}

	add_drop_icon(item, sidebar_control, item_container) {
		let drop_icon = "es-line-down";
		if (item_container.find(`[item-name="${this.current_page.name}"]`).length) {
			drop_icon = "small-up";
		}

		let $child_item_section = item_container.find(".sidebar-child-item");
		let $drop_icon = $(`<button class="btn-reset drop-icon hidden">`)
			.html(frappe.utils.icon(drop_icon, "sm"))
			.appendTo(sidebar_control);
		let pages = item.public ? this.public_pages : this.private_pages;
		if (
			pages.some(
				(e) => e.parent_page == item.title && (e.is_hidden == 0 || !this.is_read_only)
			)
		) {
			$drop_icon.removeClass("hidden");
		}
		$drop_icon.on("click", () => {
			let icon =
				$drop_icon.find("use").attr("href") === "#es-line-down"
					? "#es-line-up"
					: "#es-line-down";
			$drop_icon.find("use").attr("href", icon);
			$child_item_section.toggleClass("hidden");
		});
	}

	show() {
		if (!this.all_pages) {
			// pages not yet loaded, call again after a bit
			setTimeout(() => this.show(), 100);
			return;
		}

		let page = this.get_page_to_show();

		if (!frappe.router.current_route[0]) {
			frappe.route_flags.replace_route = true;
			frappe.set_route(frappe.router.slug(page.public ? page.name : "private/" + page.name));
			return;
		}

		this.page.set_title(this.is_home_page(page) ? __("Onerp") : __(page.name));
		this.update_selected_sidebar(this.current_page, false); //remove selected from old page
		this.update_selected_sidebar(page, true); //add selected on new page
		this.show_page(page);
	}

	update_selected_sidebar(page, add) {
		if (this.onerp_sidebar_active) {
			return;
		}

		let section = page.public ? "public" : "private";
		if (
			this.sidebar &&
			this.sidebar_items[section] &&
			this.sidebar_items[section][page.name]
		) {
			let $sidebar = this.sidebar_items[section][page.name];
			let pages = page.public ? this.public_pages : this.private_pages;
			let sidebar_page = pages.find((p) => p.title == page.name);

			if (add) {
				$sidebar[0].firstElementChild.classList.add("selected");
				if (sidebar_page) sidebar_page.selected = true;

				// open child sidebar section if closed
				$sidebar.parent().hasClass("sidebar-child-item") &&
					$sidebar.parent().hasClass("hidden") &&
					$sidebar.parent().removeClass("hidden");

				this.current_page = { name: page.name, public: page.public };
				localStorage.current_page = page.name;
				localStorage.is_current_page_public = page.public;
			} else {
				$sidebar[0].firstElementChild.classList.remove("selected");
				if (sidebar_page) sidebar_page.selected = false;
			}
		}
	}

	get_data(page) {
		return frappe
			.call("frappe.desk.desktop.get_desktop_page", {
				page: page,
			})
			.then((data) => {
				this.page_data = data.message;

				// caching page data
				this.pages[page.name] && delete this.pages[page.name];
				this.pages[page.name] = data.message;

				if (!this.page_data || Object.keys(this.page_data).length === 0) return;
				if (this.page_data.charts && this.page_data.charts.items.length === 0) return;

				return frappe.dashboard_utils.get_dashboard_settings().then((settings) => {
					if (settings) {
						let chart_config = settings.chart_config
							? JSON.parse(settings.chart_config)
							: {};
						this.page_data.charts.items.map((chart) => {
							chart.chart_settings = chart_config[chart.chart_name] || {};
						});
						this.pages[page.name] = this.page_data;
					}
				});
			});
	}

	get_page_to_show() {
		let default_page;

		const home_page = (this.all_pages || []).find(
			(page) => page.public && frappe.router.slug(page.title) === "home"
		);
		if (home_page) {
			default_page = { name: home_page.title, public: true };
		} else if (frappe.boot.user.default_workspace) {
			default_page = {
				name: frappe.boot.user.default_workspace.title,
				public: frappe.boot.user.default_workspace.public,
			};
		} else if (
			localStorage.current_page &&
			this.all_pages.filter((page) => page.title == localStorage.current_page).length != 0
		) {
			default_page = {
				name: localStorage.current_page,
				public: localStorage.is_current_page_public != "false",
			};
		} else if (Object.keys(this.all_pages).length !== 0) {
			default_page = { name: this.all_pages[0].title, public: this.all_pages[0].public };
		} else {
			default_page = { name: "Build", public: true };
		}

		const route = frappe.get_route();
		const page = (route[1] == "private" ? route[2] : route[1]) || default_page.name;
		const is_public = route[1] ? route[1] != "private" : default_page.public;
		return { name: page, public: is_public };
	}

	destroy_editorjs() {
		// Home dashboard empties the editor holder; keep a live EditorJS instance
		// around and later render() calls paint empty placeholder boxes.
		if (this.editor && typeof this.editor.destroy === "function") {
			try {
				this.editor.destroy();
			} catch (e) {
				/* holder already gone */
			}
		}
		this.editor = null;
	}

	async show_page(page) {
		if (this.is_home_page(page)) {
			this.show_home_dashboard(page);
			return;
		}

		this.body.find(".onerp-home").remove();
		$("body").removeClass("onerp-home-route").addClass("onerp-module-route");
		// Arriving from the main dashboard, the rail still holds the stock workspace
		// list until the page request returns, so revealing it here paints that list
		// for the length of the request. Build the module rail first instead.
		if (this.is_read_only && !this.sidebar.find(".onerp-sidebar").length) {
			this.make_onerp_module_sidebar(page);
		}
		this.wrapper.find(".layout-side-section").removeClass("hide");
		this.body.find(".workspace-footer").removeClass("hide");
		$(".page-head").removeClass("hide");

		const $editor_host = this.body.find(".editor-js-container");
		const editor_alive =
			this.editor &&
			this.body.find("#editorjs").length &&
			document.contains(this.body.find("#editorjs")[0]);

		if (!editor_alive) {
			this.destroy_editorjs();
			$editor_host.empty();
			$(`
				<div id="editorjs" class="desk-page page-main-content"></div>
			`).appendTo($editor_host);
		}

		if (this.all_pages.length) {
			this.create_page_skeleton();

			let pages =
				page.public && this.public_pages.length ? this.public_pages : this.private_pages;
			let current_page = pages.filter((p) => p.title == page.name)[0];
			this._page = current_page;
			this.content = current_page && JSON.parse(current_page.content);

			this.content && this.add_custom_cards_in_content();

			$(".item-anchor").addClass("disable-click");

			if (this.pages && this.pages[current_page.name]) {
				this.page_data = this.pages[current_page.name];
			} else {
				await frappe.after_ajax(() => this.get_data(current_page));
			}

			if (this.is_read_only) {
				this.make_onerp_module_sidebar(page);
			}

			this.setup_actions(page);

			this.prepare_editorjs();
			$(".item-anchor").removeClass("disable-click");
		}
	}

	is_home_page(page) {
		return !!(page && page.public && frappe.router.slug(page.name) === "home");
	}

	is_home_route() {
		return frappe.router.slug(frappe.get_route()[1] || "") === "home";
	}

	hide_workspace_sidebar() {
		$("body").addClass("onerp-home-route").removeClass("onerp-module-route");
		this.wrapper.find(".layout-side-section").addClass("hide");
	}

	show_home_dashboard(page) {
		this.onerp_sidebar_active = false;
		frappe.onerp && frappe.onerp.cache_context(null);
		this.destroy_editorjs();
		this.remove_page_skeleton();
		$("body")
			.removeClass("onerp-module-route onerp-sidebar-collapsed")
			.addClass("onerp-home-route");
		this.wrapper.find(".layout-side-section").addClass("hide");
		this.body.find(".workspace-footer").addClass("hide");
		this.page.clear_actions && this.page.clear_actions();
		this.page.set_title(__("Main Dashboard"));
		this.page.hide_menu && this.page.hide_menu();
		$(".page-head").addClass("hide");

		const $container = this.body.find(".editor-js-container");
		$container.empty();

		const module_pages = (this.public_pages || []).filter(
			(p) => !["Home", "Welcome Workspace"].includes(p.title)
		);

		const cards = module_pages
			.map((p) => {
				const slug = frappe.router.slug(p.title);
				const meta = ONERP_MODULES[slug] || {};
				const icon = p.icon || meta.icon || "es-line-folder";
				const color = meta.color || "var(--theme-brand)";
				return `
					<a class="onerp-module-card" href="/app/${slug}">
						<span class="onerp-module-icon" style="color: ${color}">
							${frappe.utils.icon(icon, "xl")}
						</span>
						<span class="onerp-module-title">${frappe.utils.escape_html(__(p.title))}</span>
						<span class="onerp-module-desc">${frappe.utils.escape_html(
							meta.description || ""
						)}</span>
						<span class="onerp-module-open">${__("Open")} →</span>
					</a>`;
			})
			.join("");

		const sub = frappe.onerp.subscription();

		$container.append(`
			<div class="onerp-home">
				<div class="onerp-home-topbar">
					<span class="onerp-home-breadcrumb">${frappe.utils.icon("home", "xs")} ${__(
			"Modules"
		)}</span>
					<h1 class="onerp-home-heading">${__("Main Dashboard")}</h1>
					<p class="onerp-home-subtitle">${__(
						sub && sub.blocked
							? "Your subscription needs attention"
							: "Select a module to manage your business"
					)}</p>
					${frappe.onerp.subscription_pill()}
				</div>
				${
					sub && sub.blocked
						? frappe.onerp.trial_expired_screen(sub)
						: `<div class="onerp-modules-grid">${cards}</div>`
				}
			</div>
		`);

		frappe.breadcrumbs.add({
			type: "Custom",
			route: "/app/home",
			label: __("Modules"),
		});
	}

	make_onerp_module_sidebar(page) {
		this.onerp_sidebar_active = true;
		$("body").removeClass("onerp-home-route").addClass("onerp-module-route");
		this.sidebar.empty();

		const current_page = (this.all_pages || []).find(
			(p) => p.title == page.name && p.public == page.public
		);
		const module = current_page && current_page.module;
		const module_pages = (this.public_pages || []).filter((p) => p.module == module);
		const company =
			frappe.defaults.get_user_default("Company") ||
			frappe.boot.sysdefaults.company ||
			frappe.boot.user.full_name ||
			__("Company");
		const module_title = current_page ? __(current_page.title) : __("Module");

		// When the rail is built before the page request returns, this.page_data still
		// belongs to the module just left, so only use data for the page being shown.
		const page_key = (current_page && current_page.name) || page.name;
		const data =
			(this.pages && this.pages[page_key]) ||
			(this._page && this._page.name === page_key ? this.page_data : null);
		const cards = data && data.cards && data.cards.items;
		const shortcuts = data && data.shortcuts && data.shortcuts.items;

		const ctx = frappe.onerp.make_context({
			module,
			module_title,
			company,
			module_pages,
			cards,
			shortcuts,
		});
		frappe.onerp.cache_context(ctx);

		const $sidebar = frappe.onerp.build_sidebar(ctx);

		this.sidebar.append($sidebar);
		this.refresh_onerp_sidebar_selection();
		this.remove_sidebar_skeleton();
	}

	refresh_onerp_sidebar_selection() {
		frappe.onerp.refresh_selection(this.sidebar);
	}

	add_custom_cards_in_content() {
		let index = -1;
		this.content.find((item, i) => {
			if (item.type == "card") index = i;
		});
		if (index !== -1) {
			this.content.splice(index + 1, 0, {
				type: "card",
				data: { card_name: "Custom Documents", col: 4 },
			});
			this.content.splice(index + 2, 0, {
				type: "card",
				data: { card_name: "Custom Reports", col: 4 },
			});
		}
	}

	prepare_editorjs() {
		const holder = this.body.find("#editorjs")[0];
		const editor_usable =
			this.editor &&
			holder &&
			this.editor.configuration &&
			(this.editor.configuration.holder === holder ||
				this.editor.configuration.holderId === "editorjs");

		if (editor_usable) {
			this.editor.isReady
				.then(() => {
					this.editor.configuration.tools.chart.config.page_data = this.page_data;
					this.editor.configuration.tools.shortcut.config.page_data = this.page_data;
					this.editor.configuration.tools.card.config.page_data = this.page_data;
					this.editor.configuration.tools.onboarding.config.page_data = this.page_data;
					this.editor.configuration.tools.quick_list.config.page_data = this.page_data;
					this.editor.configuration.tools.number_card.config.page_data = this.page_data;
					this.editor.configuration.tools.custom_block.config.page_data = this.page_data;
					return this.editor.render({ blocks: this.content || [] });
				})
				.then(() => frappe.onerp.wait_for_widgets())
				.finally(() => this.remove_page_skeleton());
		} else {
			this.destroy_editorjs();
			this.initialize_editorjs(this.content);
			this.editor.isReady
				.then(() => frappe.onerp.wait_for_widgets())
				.finally(() => this.remove_page_skeleton());
		}
	}

	setup_actions(page) {
		let pages = page.public ? this.public_pages : this.private_pages;
		let current_page = pages.filter((p) => p.title == page.name)[0];

		if (!this.is_read_only) {
			this.setup_customization_buttons(current_page);
			return;
		}

		this.clear_page_actions();
		if (current_page.is_editable) {
			this.body.find(".btn-edit-workspace").removeClass("hide");
		} else {
			this.body.find(".btn-edit-workspace").addClass("hide");
		}

		// need to add option for icons in inner buttons as well
		if (this.has_create_access) {
			this.body.find(".btn-new-workspace").removeClass("hide");
		} else {
			this.body.find(".btn-new-workspace").addClass("hide");
		}
	}

	initialize_editorjs_undo() {
		this.undo = new Undo({ editor: this.editor });
		this.undo.initialize({ blocks: this.content || [] });
		this.undo.readOnly = false;
	}

	clear_page_actions() {
		this.page.clear_primary_action();
		this.page.clear_secondary_action();
		this.page.clear_inner_toolbar();
	}

	setup_customization_buttons(page) {
		this.clear_page_actions();

		page.is_editable &&
			this.page.set_primary_action(
				__("Save"),
				() => {
					this.clear_page_actions();
					this.body.removeClass("edit-mode");
					this.save_page(page).then((saved) => {
						if (!saved) return;
						this.undo.readOnly = true;
						this.editor.readOnly.toggle();
						this.is_read_only = true;
					});
				},
				null,
				__("Saving")
			);

		this.page.set_secondary_action(__("Discard"), async () => {
			this.body.removeClass("edit-mode");
			this.discard = true;
			this.clear_page_actions();
			this.toggle_hidden_workspaces(false);
			await this.editor.readOnly.toggle();
			this.is_read_only = true;
			this.sidebar_pages = this.cached_pages;
			this.reload();
			frappe.show_alert({ message: __("Customizations Discarded"), indicator: "info" });
		});

		if (page.name && this.has_access) {
			this.page.add_inner_button(__("Settings"), () => {
				frappe.set_route(`workspace/${page.name}`);
			});
		}
	}

	toggle_hidden_workspaces(show) {
		$(".desk-sidebar").toggleClass("show-hidden-workspaces", show);
	}

	show_sidebar_actions() {
		this.sidebar.find(".standard-sidebar-section").addClass("show-control");
		this.make_sidebar_sortable();
	}

	add_sidebar_actions(item, sidebar_control, is_new) {
		if (!item.is_editable) {
			sidebar_control.parent().click(() => {
				!this.is_read_only &&
					frappe.show_alert(
						{
							message: __("Only Workspace Manager can sort or edit this page"),
							indicator: "info",
						},
						5
					);
			});

			frappe.utils.add_custom_button(
				frappe.utils.icon("es-line-duplicate", "sm"),
				() => this.duplicate_page(item),
				"duplicate-page",
				__("Duplicate Workspace"),
				null,
				sidebar_control
			);
		} else if (item.is_hidden) {
			frappe.utils.add_custom_button(
				frappe.utils.icon("es-line-preview", "sm"),
				(e) => this.unhide_workspace(item, e),
				"unhide-workspace-btn",
				__("Unhide Workspace"),
				null,
				sidebar_control
			);
		} else {
			frappe.utils.add_custom_button(
				frappe.utils.icon("es-line-drag", "xs"),
				null,
				"drag-handle",
				__("Drag"),
				null,
				sidebar_control
			);

			!is_new && this.add_settings_button(item, sidebar_control);
		}
	}

	get_parent_pages(page) {
		this.public_parent_pages = [
			"",
			...this.public_pages.filter((p) => !p.parent_page).map((p) => p.title),
		];
		this.private_parent_pages = [
			"",
			...this.private_pages.filter((p) => !p.parent_page).map((p) => p.title),
		];

		if (page) {
			return page.public ? this.public_parent_pages : this.private_parent_pages;
		}
	}

	edit_page(item) {
		var me = this;
		let old_item = item;
		let parent_pages = this.get_parent_pages(item);
		let idx = parent_pages.findIndex((x) => x == item.title);
		if (idx !== -1) parent_pages.splice(idx, 1);
		const d = new frappe.ui.Dialog({
			title: __("Update Details"),
			fields: [
				{
					label: __("Title"),
					fieldtype: "Data",
					fieldname: "title",
					reqd: 1,
					default: item.title,
				},
				{
					label: __("Parent"),
					fieldtype: "Select",
					fieldname: "parent",
					options: parent_pages,
					default: item.parent_page,
				},
				{
					label: __("Public"),
					fieldtype: "Check",
					fieldname: "is_public",
					depends_on: `eval:${this.has_access}`,
					default: item.public,
					onchange: function () {
						d.set_df_property(
							"parent",
							"options",
							this.get_value() ? me.public_parent_pages : me.private_parent_pages
						);
						d.set_df_property("icon", "hidden", this.get_value() ? 0 : 1);
						d.set_df_property("indicator_color", "hidden", this.get_value() ? 1 : 0);
					},
				},
				{
					fieldtype: "Column Break",
				},
				{
					label: __("Icon"),
					fieldtype: "Icon",
					fieldname: "icon",
					default: item.public && item.icon,
					hidden: !item.public,
				},
				{
					label: __("Indicator color"),
					fieldtype: "Select",
					fieldname: "indicator_color",
					options: this.indicator_colors,
					default: !item.public && item.indicator_color,
					hidden: item.public,
				},
			],
			primary_action_label: __("Update"),
			primary_action: (values) => {
				values.title = strip_html(values.title);
				let is_title_changed = values.title != old_item.title;
				let is_section_changed = Boolean(values.is_public) != Boolean(old_item.public);
				if (
					(is_title_changed || is_section_changed) &&
					!this.validate_page(values, old_item)
				)
					return;
				d.hide();

				frappe.call({
					method: "frappe.desk.doctype.workspace.workspace.update_page",
					args: {
						name: old_item.name,
						title: values.title,
						icon: values.icon || "",
						indicator_color: values.indicator_color || "",
						parent: values.parent || "",
						public: values.is_public || 0,
					},
					callback: function (res) {
						if (res.message) {
							let message = __("Workspace {0} Edited Successfully", [
								old_item.title.bold(),
							]);
							frappe.show_alert({ message: message, indicator: "green" });
						}
					},
				});

				this.update_sidebar(old_item, values);

				if (this.make_page_selected) {
					let pre_url = values.is_public ? "" : "private/";
					let route = pre_url + frappe.router.slug(values.title);
					frappe.set_route(route);

					this.make_page_selected = false;
				}

				this.make_sidebar();
				this.show_sidebar_actions();
			},
		});
		d.show();
	}

	update_sidebar(old_item, new_item) {
		let is_section_changed = old_item.public != (new_item.is_public || 0);
		let is_title_changed = old_item.title != new_item.title;
		let new_updated_item = { ...old_item };

		let pages = old_item.public ? this.public_pages : this.private_pages;

		let child_items = pages.filter((page) => page.parent_page == old_item.title);

		this.make_page_selected = old_item.selected;

		new_updated_item.title = new_item.title;
		new_updated_item.icon = new_item.icon;
		new_updated_item.indicator_color = new_item.indicator_color;
		new_updated_item.parent_page = new_item.parent || "";
		new_updated_item.public = new_item.is_public;

		if (is_title_changed || is_section_changed) {
			if (new_item.is_public) {
				new_updated_item.name = new_item.title;
				new_updated_item.label = new_item.title;
				new_updated_item.for_user = "";
			} else {
				let user = frappe.session.user;
				new_updated_item.name = `${new_item.title}-${user}`;
				new_updated_item.label = `${new_item.title}-${user}`;
				new_updated_item.for_user = user;
			}
		}
		this.update_cached_values(old_item, new_updated_item);

		if (child_items.length) {
			child_items.forEach((child) => {
				child.parent_page = new_item.title;
				is_section_changed && this.update_child_sidebar(child, new_item);
			});
		}
	}

	update_child_sidebar(child, new_item) {
		let old_child = { ...child };
		this.make_page_selected = child.selected;

		child.public = new_item.is_public;
		if (new_item.is_public) {
			child.name = child.title;
			child.label = child.title;
			child.for_user = "";
		} else {
			let user = frappe.session.user;
			child.name = `${child.title}-${user}`;
			child.label = `${child.title}-${user}`;
			child.for_user = user;
		}

		this.update_cached_values(old_child, child);
	}

	update_cached_values(old_item, new_item, duplicate, new_page) {
		let [from_pages, to_pages] = old_item.public
			? [this.public_pages, this.private_pages]
			: [this.private_pages, this.public_pages];

		let old_item_index = from_pages.findIndex((page) => page.title == old_item.title);
		duplicate && old_item_index++;

		// update frappe.workspaces
		if (frappe.workspaces[frappe.router.slug(old_item.name)] || new_page) {
			!duplicate && delete frappe.workspaces[frappe.router.slug(old_item.name)];
			if (new_item) {
				frappe.workspaces[frappe.router.slug(new_item.name)] = { title: new_item.title };
			}
		}

		// update page block data
		if ((this.pages && this.pages[old_item.name]) || new_page) {
			if (new_item) {
				this.pages[new_item.name] = this.pages[old_item.name] || {};
			}
			!duplicate && delete this.pages[old_item.name];
		}

		// update public and private pages
		if (new_item) {
			let is_section_changed =
				old_item.public != (new_item.is_public || new_item.public || 0);

			if (is_section_changed) {
				!duplicate && from_pages.splice(old_item_index, 1);
				to_pages.push(new_item);
			} else if (new_page) {
				from_pages.push(new_item);
			} else {
				from_pages.splice(old_item_index, duplicate ? 0 : 1, new_item);
			}
		} else {
			from_pages.splice(old_item_index, 1);
		}

		this.sidebar_pages.pages = [...this.public_pages, ...this.private_pages];
		this.cached_pages = this.sidebar_pages;
	}

	add_settings_button(item, sidebar_control) {
		this.dropdown_list = [
			{
				label: __("Edit"),
				title: __("Edit Workspace"),
				icon: frappe.utils.icon("es-line-edit", "sm"),
				action: () => this.edit_page(item),
			},
			{
				label: __("Duplicate"),
				title: __("Duplicate Workspace"),
				icon: frappe.utils.icon("es-line-duplicate", "sm"),
				action: () => this.duplicate_page(item),
			},
			{
				label: __("Hide"),
				title: __("Hide Workspace"),
				icon: frappe.utils.icon("es-line-hide", "sm"),
				action: (e) => this.hide_workspace(item, e),
			},
		];

		if (this.is_item_deletable(item)) {
			this.dropdown_list.push({
				label: __("Delete"),
				title: __("Delete Workspace"),
				icon: frappe.utils.icon("delete-active", "sm"),
				action: () => this.delete_page(item),
			});
		}

		let $button = $(`
			<div class="btn btn-xs setting-btn dropdown-btn" title="${__("Setting")}">
				${frappe.utils.icon("es-line-dot-horizontal", "xs")}
			</div>
			<div class="dropdown-list hidden"></div>
		`);

		let dropdown_item = function (label, title, icon, action) {
			let html = $(`
				<div class="dropdown-item" title="${title}">
					<span class="dropdown-item-icon">${icon}</span>
					<span class="dropdown-item-label">${label}</span>
				</div>
			`);

			html.click((event) => {
				event.stopPropagation();
				action && action(event);
			});

			return html;
		};

		$button.filter(".dropdown-btn").click((event) => {
			event.stopPropagation();
			if ($button.filter(".dropdown-list.hidden").length) {
				$(".dropdown-list:not(.hidden)").addClass("hidden");
			}
			$button.filter(".dropdown-list").toggleClass("hidden");
		});

		sidebar_control.append($button);

		this.dropdown_list.forEach((i) => {
			$button
				.filter(".dropdown-list")
				.append(dropdown_item(i.label, i.title, i.icon, i.action));
		});
	}

	is_item_deletable(item) {
		// if item is private
		// if item is public but doesn't have module set
		// if item is public and has module set but developer mode is on
		// then item is deletable
		if (
			!item.public ||
			(item.public && (!item.module || (item.module && frappe.boot.developer_mode)))
		)
			return true;
		return false;
	}

	delete_page(page) {
		frappe.confirm(
			__("Are you sure you want to delete page {0}?", [page.title.bold()]),
			() => {
				frappe.call({
					method: "frappe.desk.doctype.workspace.workspace.delete_page",
					args: { page: page },
					callback: function (res) {
						if (res.message) {
							let page = res.message;
							let message = __("Workspace {0} Deleted Successfully", [
								page.title.bold(),
							]);
							frappe.show_alert({ message: message, indicator: "green" });
						}
					},
				});

				this.page.clear_primary_action();
				this.update_cached_values(page);

				if (
					this.current_page.name == page.title &&
					this.current_page.public == page.public
				) {
					frappe.set_route("/");
				}

				this.make_sidebar();
				this.show_sidebar_actions();
			}
		);
	}

	duplicate_page(page) {
		var me = this;
		let new_page = { ...page };
		if (!this.has_access && new_page.public) {
			new_page.public = 0;
		}
		let parent_pages = this.get_parent_pages({ public: new_page.public });
		const d = new frappe.ui.Dialog({
			title: __("Create Duplicate"),
			fields: [
				{
					label: __("Title"),
					fieldtype: "Data",
					fieldname: "title",
					reqd: 1,
				},
				{
					label: __("Parent"),
					fieldtype: "Select",
					fieldname: "parent",
					options: parent_pages,
					default: new_page.parent_page,
				},
				{
					label: __("Public"),
					fieldtype: "Check",
					fieldname: "is_public",
					depends_on: `eval:${this.has_access}`,
					default: new_page.public,
					onchange: function () {
						d.set_df_property(
							"parent",
							"options",
							this.get_value() ? me.public_parent_pages : me.private_parent_pages
						);
						d.set_df_property("icon", "hidden", this.get_value() ? 0 : 1);
						d.set_df_property("indicator_color", "hidden", this.get_value() ? 1 : 0);
					},
				},
				{
					fieldtype: "Column Break",
				},
				{
					label: __("Icon"),
					fieldtype: "Icon",
					fieldname: "icon",
					default: new_page.public && new_page.icon,
					hidden: !new_page.public,
				},
				{
					label: __("Indicator color"),
					fieldtype: "Select",
					fieldname: "indicator_color",
					options: this.indicator_colors,
					hidden: new_page.public,
					default: !new_page.public && new_page.indicator_color,
				},
			],
			primary_action_label: __("Duplicate"),
			primary_action: (values) => {
				if (!this.validate_page(values)) return;
				d.hide();
				frappe.call({
					method: "frappe.desk.doctype.workspace.workspace.duplicate_page",
					args: {
						page_name: page.name,
						new_page: values,
					},
					callback: function (res) {
						if (res.message) {
							let new_page = res.message;
							let message = __(
								"Duplicate of {0} named as {1} is created successfully",
								[page.title.bold(), new_page.title.bold()]
							);
							frappe.show_alert({ message: message, indicator: "green" });
						}
					},
				});

				new_page.title = values.title;
				new_page.public = values.is_public || 0;
				new_page.name = values.title + (new_page.public ? "" : "-" + frappe.session.user);
				new_page.label = new_page.name;
				new_page.icon = values.icon;
				new_page.indicator_color = values.indicator_color;
				new_page.parent_page = values.parent || "";
				new_page.for_user = new_page.public ? "" : frappe.session.user;
				new_page.is_editable = !new_page.public;
				new_page.selected = true;

				this.update_cached_values(page, new_page, true);

				let pre_url = values.is_public ? "" : "private/";
				let route = pre_url + frappe.router.slug(values.title);
				frappe.set_route(route);

				me.make_sidebar();
				me.show_sidebar_actions();
			},
		});
		d.show();
	}

	hide_unhide_workspace(page, event, hide) {
		page.is_hidden = hide;

		let sidebar_control = event.target.closest(".sidebar-item-control");
		let sidebar_item_container = sidebar_control.closest(".sidebar-item-container");
		$(sidebar_item_container).attr("item-is-hidden", hide);

		$(sidebar_control).empty();
		this.add_sidebar_actions(page, $(sidebar_control));

		this.add_drop_icon(page, $(sidebar_control), $(sidebar_item_container));

		let cached_page = this.cached_pages.pages.findIndex((p) => p.name === page.name);
		if (cached_page !== -1) {
			this.cached_pages.pages[cached_page].is_hidden = hide;
		}

		let method = hide ? "hide_page" : "unhide_page";
		frappe.call({
			method: "frappe.desk.doctype.workspace.workspace." + method,
			args: {
				page_name: page.name,
			},
			callback: (r) => {
				if (!r.message) return;

				let message = hide ? "{0} is hidden successfully" : "{0} is unhidden successfully";
				message = __(message, [page.title.bold()]);
				frappe.show_alert({ message: message, indicator: "green" });
			},
		});
	}

	hide_workspace(page, event) {
		this.hide_unhide_workspace(page, event, 1);
	}

	unhide_workspace(page, event) {
		this.hide_unhide_workspace(page, event, 0);
	}

	make_sidebar_sortable() {
		let me = this;
		$(".nested-container").each(function () {
			new Sortable(this, {
				handle: ".drag-handle",
				draggable: ".sidebar-item-container.is-draggable",
				group: "nested",
				animation: 150,
				fallbackOnBody: true,
				swapThreshold: 0.65,
				onEnd: function (evt) {
					let is_public = $(evt.item).attr("item-public") == "1";
					me.prepare_sorted_sidebar(is_public);
					me.update_sorted_sidebar();
				},
			});
		});
	}

	prepare_sorted_sidebar(is_public) {
		let pages = is_public ? this.public_pages : this.private_pages;
		if (is_public) {
			this.sorted_public_items = this.sort_sidebar(
				this.sidebar.find(".standard-sidebar-section").last(),
				pages
			);
		} else {
			this.sorted_private_items = this.sort_sidebar(
				this.sidebar.find(".standard-sidebar-section").first(),
				pages
			);
		}

		this.sidebar_pages.pages = [...this.public_pages, ...this.private_pages];
		this.cached_pages = this.sidebar_pages;
	}

	sort_sidebar($sidebar_section, pages) {
		let sorted_items = [];
		Array.from($sidebar_section.find(".sidebar-item-container")).forEach((page, i) => {
			let parent_page = "";

			if (page.closest(".nested-container").classList.contains("sidebar-child-item")) {
				parent_page = page.parentElement.parentElement.attributes["item-name"].value;
			}

			sorted_items.push({
				title: page.attributes["item-name"].value,
				parent_page: parent_page,
				public: page.attributes["item-public"].value,
			});

			let $drop_icon = $(page).find(".sidebar-item-control .drop-icon").first();
			if ($(page).find(".sidebar-child-item > *").length != 0) {
				$drop_icon.removeClass("hidden");
			} else {
				$drop_icon.addClass("hidden");
			}

			let from_index = pages.findIndex((p) => p.title == page.attributes["item-name"].value);
			let element = pages[from_index];
			element.parent_page = parent_page;
			if (from_index != i) {
				pages.splice(from_index, 1);
				pages.splice(i, 0, element);
			}
		});
		return sorted_items;
	}

	update_sorted_sidebar() {
		if (this.sorted_public_items || this.sorted_private_items) {
			frappe.call({
				method: "frappe.desk.doctype.workspace.workspace.sort_pages",
				args: {
					sb_public_items: this.sorted_public_items,
					sb_private_items: this.sorted_private_items,
				},
				callback: function (res) {
					if (res.message) {
						let message = `Sidebar Updated Successfully`;
						frappe.show_alert({ message: __(message), indicator: "green" });
					}
				},
			});
		}
	}

	make_blocks_sortable() {
		let me = this;
		this.page_sortable = Sortable.create(
			this.page.main.find(".codex-editor__redactor").get(0),
			{
				handle: ".drag-handle",
				draggable: ".ce-block",
				animation: 150,
				onEnd: function (evt) {
					me.editor.blocks.move(evt.newIndex, evt.oldIndex);
				},
				setData: function () {
					//Do Nothing
				},
			}
		);
	}

	initialize_new_page() {
		var me = this;
		this.get_parent_pages();
		const d = new frappe.ui.Dialog({
			title: __("New Workspace"),
			fields: [
				{
					label: __("Title"),
					fieldtype: "Data",
					fieldname: "title",
					reqd: 1,
				},
				{
					label: __("Parent"),
					fieldtype: "Select",
					fieldname: "parent",
					options: this.private_parent_pages,
				},
				{
					label: __("Public"),
					fieldtype: "Check",
					fieldname: "is_public",
					depends_on: `eval:${this.has_access}`,
					onchange: function () {
						d.set_df_property(
							"parent",
							"options",
							this.get_value() ? me.public_parent_pages : me.private_parent_pages
						);
						d.set_df_property("icon", "hidden", this.get_value() ? 0 : 1);
						d.set_df_property("indicator_color", "hidden", this.get_value() ? 1 : 0);
					},
				},
				{
					fieldtype: "Column Break",
				},
				{
					label: __("Icon"),
					fieldtype: "Icon",
					fieldname: "icon",
					hidden: 1,
				},
				{
					label: __("Indicator color"),
					fieldtype: "Select",
					fieldname: "indicator_color",
					options: this.indicator_colors,
				},
			],
			primary_action_label: __("Create"),
			primary_action: (values) => {
				values.title = strip_html(values.title);
				if (!this.validate_page(values)) return;
				d.hide();
				this.initialize_editorjs_undo();
				this.setup_customization_buttons({ is_editable: true });

				let name = values.title + (values.is_public ? "" : "-" + frappe.session.user);
				let blocks = [
					{
						type: "header",
						data: { text: values.title },
					},
				];

				let new_page = {
					content: JSON.stringify(blocks),
					name: name,
					label: name,
					title: values.title,
					public: values.is_public || 0,
					for_user: values.is_public ? "" : frappe.session.user,
					icon: values.icon,
					indicator_color: values.indicator_color,
					parent_page: values.parent || "",
					is_editable: true,
					selected: true,
				};

				this.editor
					.render({
						blocks: blocks,
					})
					.then(async () => {
						if (this.editor.configuration.readOnly) {
							this.is_read_only = false;
							await this.editor.readOnly.toggle();
						}

						frappe.call({
							method: "frappe.desk.doctype.workspace.workspace.new_page",
							args: {
								new_page: new_page,
							},
							callback: function (res) {
								if (res.message) {
									let message = __("Workspace {0} Created Successfully", [
										new_page.title.bold(),
									]);
									frappe.show_alert({
										message: message,
										indicator: "green",
									});
								}
							},
						});

						this.update_cached_values(new_page, new_page, true, true);

						let pre_url = new_page.public ? "" : "private/";
						let route = pre_url + frappe.router.slug(new_page.title);
						frappe.set_route(route);

						this.make_sidebar();
						this.show_sidebar_actions();
						localStorage.setItem("new_workspace", JSON.stringify(new_page));
					});
			},
		});
		d.show();
	}

	validate_page(new_page, old_page) {
		let message = "";
		let [from_pages, to_pages] = new_page.is_public
			? [this.private_pages, this.public_pages]
			: [this.public_pages, this.private_pages];

		let section = this.sidebar_categories[new_page.is_public];

		if (to_pages && to_pages.filter((p) => p.title == new_page.title)[0]) {
			message = __("Page with title {0} already exist.", [new_page.title.bold()]);
		}

		if (frappe.router.doctype_route_exist(frappe.router.slug(new_page.title))) {
			message = __("Doctype with same route already exist. Please choose different title.");
		}

		let child_pages = old_page && from_pages.filter((p) => p.parent_page == old_page.title);
		if (child_pages) {
			child_pages.every((child_page) => {
				if (to_pages && to_pages.find((p) => p.title == child_page.title)) {
					message = __(
						"One of the child page with name {0} already exist in {1} Section. Please update the name of the child page first before moving",
						[child_page.title.bold(), section.bold()]
					);
					cur_dialog.hide();
					return false;
				}
				return true;
			});
		}

		if (message) {
			frappe.throw(__(message));
			return false;
		}
		return true;
	}

	add_page_to_sidebar(page) {
		let $sidebar = $(".standard-sidebar-section");
		let item = { ...page };

		item.selected = true;
		item.is_editable = true;

		let $sidebar_item = this.sidebar_item_container(item);

		this.add_sidebar_actions(item, $sidebar_item.find(".sidebar-item-control"), true);

		$sidebar_item.find(".sidebar-item-control .drag-handle").css("margin-right", "8px");

		let sidebar_section = item.is_public ? $sidebar[1] : $sidebar[0];

		if (!item.parent) {
			!item.is_public && $sidebar.first().removeClass("hidden");
			$sidebar_item.appendTo(sidebar_section);
		} else {
			let $item_container = $(sidebar_section).find(`[item-name="${item.parent}"]`);
			let $child_section = $item_container.find(".sidebar-child-item");
			let $drop_icon = $item_container.find(".drop-icon");
			if (!$child_section[0]) {
				$child_section = $(
					`<div class="sidebar-child-item hidden nested-container"></div>`
				).appendTo($item_container);
				$drop_icon.toggleClass("hidden");
			}
			$sidebar_item.appendTo($child_section);
			$child_section.removeClass("hidden");
			$item_container.find(".drop-icon.hidden").removeClass("hidden");
			$item_container.find(".drop-icon use").attr("href", "#es-line-up");
		}

		let section = item.is_public ? "public" : "private";
		if (
			this.sidebar_items &&
			this.sidebar_items[section] &&
			!this.sidebar_items[section][item.title]
		) {
			this.sidebar_items[section][item.title] = $sidebar_item;
		}
	}

	initialize_editorjs(blocks) {
		this.tools = {
			header: {
				class: this.blocks["header"],
				inlineToolbar: ["HeaderSize", "bold", "italic", "link"],
				config: {
					default_size: 4,
				},
			},
			paragraph: {
				class: this.blocks["paragraph"],
				inlineToolbar: ["HeaderSize", "bold", "italic", "link"],
				config: {
					placeholder: __("Choose a block or continue typing"),
				},
			},
			chart: {
				class: this.blocks["chart"],
				config: {
					page_data: this.page_data || [],
				},
			},
			card: {
				class: this.blocks["card"],
				config: {
					page_data: this.page_data || [],
				},
			},
			shortcut: {
				class: this.blocks["shortcut"],
				config: {
					page_data: this.page_data || [],
				},
			},
			onboarding: {
				class: this.blocks["onboarding"],
				config: {
					page_data: this.page_data || [],
				},
			},
			quick_list: {
				class: this.blocks["quick_list"],
				config: {
					page_data: this.page_data || [],
				},
			},
			number_card: {
				class: this.blocks["number_card"],
				config: {
					page_data: this.page_data || [],
				},
			},
			custom_block: {
				class: this.blocks["custom_block"],
				config: {
					page_data: this.page_data || [],
				},
			},
			spacer: this.blocks["spacer"],
			HeaderSize: frappe.workspace_block.tunes["header_size"],
		};

		this.editor = new EditorJS({
			data: {
				blocks: blocks || [],
			},
			tools: this.tools,
			autofocus: false,
			readOnly: true,
			logLevel: "ERROR",
		});
	}

	save_page(page) {
		let me = this;
		this.current_page = { name: page.title, public: page.public };

		return this.editor
			.save()
			.then((outputData) => {
				let new_widgets = {};

				outputData.blocks.forEach((item) => {
					if (item.data.new) {
						if (!new_widgets[item.type]) {
							new_widgets[item.type] = [];
						}
						new_widgets[item.type].push(item.data.new);
						delete item.data["new"];
					}
				});

				let blocks = outputData.blocks.filter(
					(item) =>
						item.type != "card" ||
						(item.data.card_name !== "Custom Documents" &&
							item.data.card_name !== "Custom Reports")
				);

				if (
					page.content == JSON.stringify(blocks) &&
					Object.keys(new_widgets).length === 0
				) {
					this.setup_customization_buttons(page);
					frappe.show_alert({
						message: __("No changes made on the page"),
						indicator: "warning",
					});
					return false;
				}

				this.create_page_skeleton();
				page.content = JSON.stringify(blocks);
				frappe.call({
					method: "frappe.desk.doctype.workspace.workspace.save_page",
					args: {
						title: page.title,
						public: page.public || 0,
						new_widgets: new_widgets,
						blocks: JSON.stringify(blocks),
					},
					callback: function (res) {
						if (res.message) {
							me.discard = true;
							me.update_cached_values(page, page);
							me.reload();
							frappe.show_alert({
								message: __("Page Saved Successfully"),
								indicator: "green",
							});
						}
					},
				});
				return true;
			})
			.catch((error) => {
				error;
				// console.log('Saving failed: ', error);
			});
	}

	reload() {
		this.sorted_public_items = [];
		this.sorted_private_items = [];
		this.setup_pages(true);
		this.discard = false;
		this.undo.readOnly = true;
	}

	create_page_skeleton() {
		if (this.body.find(".workspace-skeleton").length) return;

		// The stock skeleton is drawn from shortcut/card blocks, which the Onerp sidebar
		// hides -- so it flashed blocks that then vanished. A spinner reads as "loading".
		const skeleton = this.is_read_only
			? `<div class="workspace-skeleton onerp-loading">
					<div class="onerp-loading-spinner"></div>
				</div>`
			: frappe.render_template("workspace_loading_skeleton");

		this.body.prepend(skeleton);
		this.body.find(".codex-editor").addClass("hidden");
	}

	remove_page_skeleton() {
		this.body.find(".codex-editor").removeClass("hidden");
		this.body.find(".workspace-skeleton").remove();
	}

	create_sidebar_skeleton() {
		if ($(".workspace-sidebar-skeleton").length) return;

		$(frappe.render_template("workspace_sidebar_loading_skeleton")).insertBefore(this.sidebar);
		this.sidebar.addClass("hidden");
	}

	remove_sidebar_skeleton() {
		this.sidebar.removeClass("hidden");
		$(".workspace-sidebar-skeleton").remove();
	}

	register_awesomebar_shortcut() {
		"abcdefghijklmnopqrstuvwxyz".split("").forEach((letter) => {
			const default_shortcut = {
				action: (e) => {
					$("#navbar-search").focus();
					return false; // don't prevent default = type the letter in awesomebar
				},
				page: this.page,
			};
			frappe.ui.keys.add_shortcut({ shortcut: letter, ...default_shortcut });
			frappe.ui.keys.add_shortcut({ shortcut: `shift+${letter}`, ...default_shortcut });
		});
	}
};

// ---------------------------------------------------------------
// Onerp module sidebar — shared across workspace AND module pages
// ---------------------------------------------------------------
frappe.onerp = {
	context: null,

	link_href(item) {
		if (!item || item.type === "Card Break") return null;
		const type = String(item.link_type || item.type || "").toLowerCase();

		// Shortcut rows carry the address in `url`; card links may precompute a route.
		if (type === "url") return /^https?:\/\/.+/.test(item.url || "") ? item.url : null;

		// Report names are not slugified and dashboards live under dashboard-view/, so
		// these hrefs must come from the same helper the stock widgets use.
		const opts = {
			route: item.route,
			name: item.link_to,
			type: item.link_type || item.type,
			is_query_report: item.is_query_report,
			doctype: item.ref_doctype || null,
			doc_view: item.doc_view,
			kanban_board: item.kanban_board,
			report_ref_doctype: item.report_ref_doctype,
		};
		if (type === "report" && !item.is_query_report) {
			opts.doctype = item.dependencies;
		}

		const href = frappe.utils.generate_route(opts);
		return href === "/app/" ? null : href;
	},

	make_context({ module, module_title, company, module_pages, cards, shortcuts }) {
		return {
			module: module || module_title,
			module_title,
			company,
			module_pages: (module_pages || []).map((p) => ({
				title: __(p.title),
				slug: frappe.router.slug(p.title),
				href: p.public
					? `/app/${frappe.router.slug(p.title)}`
					: `/app/private/${frappe.router.slug(p.title)}`,
				icon: p.icon,
			})),
			cards: (cards || [])
				.map((card) => ({
					label: __(card.label),
					links: (card.links || [])
						.filter((item) => this.link_href(item))
						.map((item) => ({
							label: __(item.label || item.name),
							href: this.link_href(item),
						})),
				}))
				.filter((card) => card.links.length),
			shortcuts: (shortcuts || [])
				.filter((item) => this.link_href(item))
				.map((item) => ({
					label: __(item.label || item.link_to),
					href: this.link_href(item),
				})),
		};
	},

	cache_context(ctx) {
		this.context = ctx;
		try {
			if (ctx && ctx.module) {
				sessionStorage.setItem("onerp_active_module", ctx.module);
			} else {
				sessionStorage.removeItem("onerp_active_module");
			}
		} catch (e) {
			/* private mode / blocked storage */
		}
	},

	// Blocks are in the DOM before their data: every chart, number card and quick list
	// fetches separately and keeps a visible loading node until it lands. Dropping the
	// spinner at render time is what left the dashboard looking like a blank page.
	wait_for_widgets(timeout_ms = 6000) {
		const pending = ".chart-loading-state, .number-card-loading, .list-loading-state";
		const deadline = Date.now() + timeout_ms;

		return new Promise((resolve) => {
			const check = () => {
				const waiting = [...document.querySelectorAll(pending)].some(
					(el) => el.offsetParent !== null
				);
				if (!waiting || Date.now() > deadline) return resolve();
				setTimeout(check, 150);
			};
			check();
		});
	},

	build_sidebar(ctx) {
		const $sidebar = $(`<div class="onerp-sidebar"></div>`);
		const icon_for = (p) => p.icon || (ONERP_MODULES[p.slug] || {}).icon || "es-line-folder";

		$sidebar.append(`
			<div class="onerp-sidebar-toolbar">
				<button type="button" class="btn-reset onerp-sidebar-collapse" title="${__(
					"Collapse sidebar"
				)}" aria-label="${__("Collapse sidebar")}">
					${frappe.utils.icon("es-line-sidebar-collapse", "sm")}
				</button>
			</div>
			<a class="onerp-sidebar-brand" href="/app/home" title="${__("Go to module selection")}">
				<div class="onerp-sidebar-brand-mark">${frappe.utils.icon("organization", "md")}</div>
				<div class="onerp-sidebar-brand-text">
					<div class="onerp-sidebar-brand-name">${frappe.utils.escape_html(
						ctx.company
					)}</div>
					<div class="onerp-sidebar-brand-module">${frappe.utils.escape_html(
						ctx.module_title
					)} ${__("Module")}</div>
				</div>
			</a>
			<div class="onerp-sidebar-scroll">
				<span class="onerp-sidebar-label">${frappe.utils.escape_html(
					__(ctx.module)
				)} ${__("Navigation")}</span>
			</div>
		`);

		const $scroll = $sidebar.find(".onerp-sidebar-scroll");

		if (ctx.module_pages.length) {
			const $group = $(`
				<div class="onerp-sidebar-group">
					<button class="btn-reset onerp-sidebar-group-toggle" type="button">
						<span class="onerp-sidebar-group-name">${__("Workspaces")}</span>
						${frappe.utils.icon("es-line-down", "xs")}
					</button>
					<div class="onerp-sidebar-group-items"></div>
				</div>
			`);
			ctx.module_pages.forEach((p) => {
				$group.find(".onerp-sidebar-group-items").append(`
					<a class="onerp-sidebar-item workspace-item" href="${p.href}">
						<span>${frappe.utils.escape_html(p.title)}</span>
						${frappe.utils.icon(icon_for(p), "sm")}
					</a>
				`);
			});
			$scroll.append($group);
		}

		ctx.cards.forEach((card, idx) => {
			const $group = $(`
				<div class="onerp-sidebar-group ${idx === 0 ? "" : "collapsed"}">
					<button class="btn-reset onerp-sidebar-group-toggle" type="button">
						<span class="onerp-sidebar-group-name">${frappe.utils.escape_html(card.label)}</span>
						${frappe.utils.icon("es-line-down", "xs")}
					</button>
					<div class="onerp-sidebar-group-items"></div>
				</div>
			`);
			card.links.forEach((item) => {
				$group.find(".onerp-sidebar-group-items").append(`
					<a class="onerp-sidebar-item" href="${item.href}">
						<span>${frappe.utils.escape_html(item.label)}</span>
						${frappe.utils.icon("es-line-list", "xs")}
					</a>
				`);
			});
			$scroll.append($group);
		});

		if (ctx.shortcuts.length) {
			$scroll.append(`<span class="onerp-sidebar-label">${__("Shortcuts")}</span>`);
			ctx.shortcuts.forEach((item) => {
				$scroll.append(`
					<a class="onerp-sidebar-item" href="${item.href}">
						<span>${frappe.utils.escape_html(item.label)}</span>
						${frappe.utils.icon("es-line-zap", "xs")}
					</a>
				`);
			});
		}

		$scroll.append(`
			<div class="onerp-sidebar-divider"></div>
			<span class="onerp-sidebar-label">${__("Main Menu")}</span>
			<a class="onerp-sidebar-item" href="/app/home">
				<span>${__("Main Dashboard")}</span>
				${frappe.utils.icon("es-line-home", "sm")}
			</a>
		`);

		$sidebar.append(`
			<div class="onerp-sidebar-footer">
				<div class="onerp-sidebar-help">
					<div class="onerp-sidebar-help-icon">${frappe.utils.icon("help", "sm")}</div>
					<div>
						<div class="onerp-sidebar-help-title">${__("Need Help?")}</div>
						<div class="onerp-sidebar-help-sub">${__("Contact our support team")}</div>
					</div>
				</div>
				<a class="onerp-sidebar-logout" href="/logout">
					<span>${__("Logout")}</span>
					${frappe.utils.icon("logout", "sm")}
				</a>
			</div>
		`);

		$sidebar.on("click", ".onerp-sidebar-group-toggle", function () {
			$(this).closest(".onerp-sidebar-group").toggleClass("collapsed");
		});
		$sidebar.on("click", ".onerp-sidebar-collapse", () => {
			$sidebar.closest(".layout-side-section").toggleClass("onerp-sidebar-collapsed");
			$("body").toggleClass("onerp-sidebar-collapsed");
		});

		return $sidebar;
	},

	refresh_selection($host) {
		const current_path = window.location.pathname.replace(/\/+$/, "");
		$host.find(".onerp-sidebar-item").removeClass("active");
		$host.find(".onerp-sidebar-item").each(function () {
			const href = ($(this).attr("href") || "").replace(/\/+$/, "");
			if (!href || href === "#") return;
			const active =
				current_path === href ||
				(href !== "/app" && current_path.startsWith(href + "/"));
			if (!active) return;
			$(this).addClass("active");
			$(this).closest(".onerp-sidebar-group").removeClass("collapsed");
		});
	},

	// Prefer the module the user entered from (Buying/Stock/...). Only fall back
	// to the DocType's own module when there is no cached workspace context yet
	// (direct URL / refresh). Buying links Material Request (Stock) etc.
	async resolve_context(fallback_module) {
		if (this.context) return this.context;
		let remembered = null;
		try {
			remembered = sessionStorage.getItem("onerp_active_module");
		} catch (e) {
			/* ignore */
		}
		const module = remembered || fallback_module;
		if (!module) return null;
		return await this.load_context_for_module(module);
	},

	// List pages: keep the module sidebar and move the filter widget to the top bar
	async setup_list_sidebar() {
		if (!window.cur_list || !cur_list.page || !cur_list.page.sidebar) return;
		const page = cur_list.page;
		const $host = page.sidebar;
		const $list_sidebar = $host.find(".list-sidebar");

		$("body").removeClass("onerp-home-route").addClass("onerp-module-route");

		// Move "Filter By" + "Save Filter" widgets from the sidebar into the top bar
		const $page_form = page.main && page.main.find(".page-form");
		if ($page_form && $page_form.length) {
			const $bar = $(`<div class="onerp-filter-bar"></div>`);
			$list_sidebar.find(".sidebar-section.filter-section").appendTo($bar);
			$list_sidebar.find(".sidebar-section.save-filter-section").appendTo($bar);
			if ($bar.children().length) {
				$page_form.append($bar);
			}
		}

		const list_module = cur_list.meta && cur_list.meta.module;
		const ctx = await this.resolve_context(list_module);
		if (!ctx) return;

		$list_sidebar.addClass("onerp-host").empty().append(this.build_sidebar(ctx));
		this.refresh_selection($host);
	},

	// Form pages: inject the module sidebar into the page's empty layout-side-section
	async setup_form_sidebar(frm) {
		const route = frappe.get_route();
		if (!route || route[0] !== "Form") return;
		if (!frm || !frm.page || !frm.page.sidebar || !frm.page.sidebar.length) return;

		// ignore forms inside dialogs/quick-entry, only the routed page's form
		const current_page_el = window.cur_page && window.cur_page.page;
		if (!current_page_el || current_page_el.frm !== frm) return;

		const meta = frm.meta;
		if (!meta || !meta.module) return;

		const ctx = await this.resolve_context(meta.module);
		if (!ctx) return;

		const $host = frm.page.sidebar;
		// New/unsaved forms call hide-sidebar — keep the module rail visible anyway.
		$host.removeClass("hide-sidebar").addClass("onerp-host");
		$host.find(".form-sidebar").addClass("hidden");

		$("body").removeClass("onerp-home-route").addClass("onerp-module-route");

		if ($host.find(".onerp-sidebar").length) {
			this.refresh_selection($host);
			return;
		}

		$host.prepend(this.build_sidebar(ctx));
		this.refresh_selection($host);
	},

	// The stock "My Profile" page is an activity dashboard (energy points, heatmap)
	// that has nothing to show a tenant; send them to their own account instead.
	profile_href() {
		return this.subscription() ? `/app/user/${encodeURIComponent(frappe.session.user)}` : null;
	},

	setup_profile_link() {
		const href = this.profile_href();
		if (!href) return;
		$("#toolbar-user a[href^='/app/user-profile']").attr("href", href);
	},

	tidy_profile_form(frm) {
		if (!this.subscription()) return;
		if (frm.doctype !== "User" || frm.doc.name !== frappe.session.user) return;

		if (!frm._onerp_buttons_guarded) {
			// user.js adds this during its own refresh, which runs after this hook, so
			// filter it at the source instead of removing it afterwards. It emails a
			// reset link -- an admin action; the in-form Change Password section is
			// left alone for self-service.
			const add_button = frm.add_custom_button.bind(frm);
			frm.add_custom_button = (label, fn, group) =>
				label === __("Reset Password") ? null : add_button(label, fn, group);
			frm._onerp_buttons_guarded = true;
		}

		ONERP_PROFILE_LOCKED_FIELDS.forEach((fieldname) => {
			frm.set_df_property(fieldname, "hidden", 1);
		});

		// The module rail replaces the form sidebar, and the sidebar carried the only
		// control a user had for their own picture.
		frm.set_df_property("user_image", "hidden", 0);
	},

	// A tenant's roles give `select` but not `read` on User, so the list payload comes
	// without `enabled` and the stock indicator falls through to a false "Disabled".
	patch_user_list_indicator() {
		if (this._user_indicator_patched || !frappe.get_indicator) return;
		this._user_indicator_patched = true;

		const stock = frappe.get_indicator;
		frappe.get_indicator = function (doc, doctype, show_workflow_state) {
			const indicator = stock.call(this, doc, doctype, show_workflow_state);
			const is_own_row =
				doctype === "User" &&
				doc &&
				doc.name === frappe.session.user &&
				doc.enabled === undefined;
			if (is_own_row && (!indicator || indicator[1] === "grey")) {
				return [__("Active"), "green", "enabled,=,1"];
			}
			return indicator;
		};
	},

	async load_context_for_module(module) {
		try {
			const sidebar_items = await frappe.xcall(
				"frappe.desk.desktop.get_workspace_sidebar_items"
			);
			const pages = (sidebar_items && sidebar_items.pages) || [];
			const module_pages = pages.filter((p) => p.module === module);
			const module_workspace =
				module_pages.find((p) => p.title === module) || module_pages[0];

			let cards = [];
			let shortcuts = [];
			if (module_workspace) {
				const page_data = await frappe.call("frappe.desk.desktop.get_desktop_page", {
					page: { name: module_workspace.title, public: !!module_workspace.public },
				});
				cards = (page_data.message &&
					page_data.message.cards &&
					page_data.message.cards.items) || [];
				shortcuts = (page_data.message &&
					page_data.message.shortcuts &&
					page_data.message.shortcuts.items) || [];
			}

			const company =
				frappe.defaults.get_user_default("Company") ||
				frappe.boot.sysdefaults.company ||
				frappe.boot.user.full_name ||
				__("Company");

			const ctx = this.make_context({
				module,
				module_title: module_workspace ? __(module_workspace.title) : __(module),
				company,
				module_pages,
				cards,
				shortcuts,
			});
			this.cache_context(ctx);
			return ctx;
		} catch (e) {
			return null;
		}
	},

	// Trial state ships with boot; erpnext.api.saas also rejects every save server-side.
	subscription() {
		const sub = frappe.boot && frappe.boot.onerp_subscription;
		return sub && sub.is_tenant ? sub : null;
	},

	subscription_pill() {
		const sub = this.subscription();
		if (!sub || sub.blocked) return "";
		const label =
			sub.status === "active"
				? __("Subscription active")
				: __("Free trial: {0} days left", [sub.days_left]);
		return `<span class="onerp-trial-pill">${frappe.utils.icon("hourglass", "xs")} ${label}</span>`;
	},

	trial_expired_screen(sub) {
		const company = sub.company_name ? frappe.utils.escape_html(sub.company_name) : __("Your company");
		const suspended = sub.status === "suspended";
		const title = suspended ? __("Your account is suspended") : __("Your free trial has ended");
		const detail = suspended
			? __("{0} · access is on hold", [company])
			: __("{0} · trial expired on {1}", [
					company,
					frappe.datetime.str_to_user((sub.trial_end || "").split(" ")[0]),
			  ]);

		return `
			<div class="onerp-trial-expired">
				<div class="onerp-trial-expired-icon">${frappe.utils.icon("lock", "lg")}</div>
				<h2>${title}</h2>
				<p>${detail}</p>
				<p class="onerp-trial-expired-note">${__(
					"Your data is safe and nothing has been deleted. Contact our team to activate your subscription and continue where you left off."
				)}</p>
			</div>
		`;
	},
};

// Expired tenants are parked on the dashboard; the module grid is not rendered for them.
frappe.router.on("change", () => {
	const sub = frappe.onerp.subscription();
	if (sub && sub.blocked && frappe.get_route_str() !== "home") {
		frappe.set_route("home");
	}
});

$(document).on("list_sidebar_setup", () => {
	frappe.onerp.patch_user_list_indicator();
	frappe.onerp.setup_list_sidebar();
});
$(document).on("form-refresh", (e, frm) => {
	frappe.onerp.tidy_profile_form(frm);
	frappe.onerp.setup_form_sidebar(frm);
});
$(document).on("toolbar_setup", () => frappe.onerp.setup_profile_link());
