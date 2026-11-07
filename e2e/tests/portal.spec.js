import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { ADMIN, API_URL, WEB_URL, serverEnv } from "../env.js";

// One story, in order: a visitor pledges, an admin assigns it, a devotee follows up and records
// a payment, and the admin sees it in reports. Each step builds on the previous one.
test.describe.configure({ mode: "serial" });

const SEVAK = { name: "Radha Test", phone: "98765 43210", email: "radha@example.org", amount: 1100 };
const NOTE = "Hare Krishna, please call in the evening";
const DEVOTEE = { name: "Gopal Das", email: "gopal@example.org", password: "gopal-own-password-1" };
const ADMIN_NEW_PASSWORD = "admin-own-password-1";

let admin;
let devotee;
let devoteeTempPassword;

test.beforeAll(async ({ browser }) => {
  const open = async () => {
    const page = await (await browser.newContext({ baseURL: WEB_URL, timezoneId: "Asia/Kolkata" })).newPage();
    page.on("dialog", (d) => d.accept());
    return page;
  };
  admin = await open();
  devotee = await open();
});

test.afterAll(async () => {
  await admin?.context().close();
  await devotee?.context().close();
});

const nav = (page, name) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true });

async function signIn(page, email, password) {
  await page.goto("/portal/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function choosePassword(page, current, next) {
  await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible();
  await page.getByLabel("Current password").fill(current);
  await page.getByLabel(/^New password/).fill(next);
  await page.getByLabel("Confirm new password").fill(next);
  await page.getByRole("button", { name: "Save password" }).click();
}

test("the migration carried the old submission into the new model", async ({ request }) => {
  const stats = await (await request.get(`${API_URL}/api/stats`)).json();
  expect(stats).toEqual({ ok: true, totalPledged: 501, totalSewaks: 1, target: 155000 });
});

test("a visitor offers seva on the public site", async ({ page }) => {
  await page.goto("/");
  const form = page.locator("form#seva-form");
  await form.getByLabel(/Full name/).fill(SEVAK.name);
  await form.getByLabel(/Phone/).fill(SEVAK.phone);
  await form.getByLabel(/^Email/).fill(SEVAK.email);
  await form.getByRole("button", { name: "Other" }).click();
  await form.getByLabel(/Custom amount/).fill(String(SEVAK.amount));
  await form.getByLabel(/A few words/).fill(NOTE);
  await form.getByLabel(/happy to be contacted/).check();
  await form.getByRole("button", { name: "Offer my seva" }).click();
  await expect(page.getByRole("heading", { name: /Hare Krishna, Radha/ })).toBeVisible();

  const stats = await (await page.request.get(`${API_URL}/api/stats`)).json();
  expect(stats).toEqual({ ok: true, totalPledged: 501 + SEVAK.amount, totalSewaks: 2, target: 155000 });
});

test("the portal opens with or without the trailing slash", async ({ page }) => {
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/portal\/$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("a wrong password is rejected", async ({ page }) => {
  await signIn(page, ADMIN.email, "not-the-password");
  await expect(page.getByRole("alert")).toHaveText("Incorrect email or password.");
});

test("the admin must replace the temporary password, then sees the dashboard", async () => {
  await signIn(admin, ADMIN.email, ADMIN.password);
  await choosePassword(admin, ADMIN.password, ADMIN_NEW_PASSWORD);
  await expect(admin.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(admin.locator(".stat-card", { hasText: "Waiting for a devotee" }).locator("strong")).toHaveText("2");
  // The web pledge notifies admins; migrated history doesn't.
  await expect(admin.getByRole("link", { name: "Notifications, 1 unread" })).toBeVisible();
});

test("the admin adds a follow-up devotee", async () => {
  await nav(admin, "Staff").click();
  const form = admin.getByRole("form", { name: "Add a staff member" });
  await form.getByLabel("Name").fill(DEVOTEE.name);
  await form.getByLabel("Email").fill(DEVOTEE.email);
  await form.getByLabel("Role").selectOption("followup");
  devoteeTempPassword = await form.getByLabel(/Temporary password/).inputValue();
  await form.getByRole("button", { name: "Add devotee" }).click();

  await expect(admin.locator(".creds code")).toHaveText(devoteeTempPassword);
  await expect(admin.getByRole("row", { name: new RegExp(DEVOTEE.name) })).toContainText("Invited");
});

test("the admin opens the new pledge and assigns it", async () => {
  await nav(admin, "Pledges").click();
  await admin.getByRole("link", { name: new RegExp(SEVAK.name) }).click();
  await expect(admin.getByRole("heading", { name: SEVAK.name })).toBeVisible();
  await expect(admin.locator(".detail-sub")).toContainText("₹1,100");
  await expect(admin.locator(".detail-sub")).toContainText("Prachar Sahyog Seva");
  await expect(admin.locator(".sevak-message")).toContainText(NOTE);
  await expect(admin.getByRole("link", { name: /Call \+919876543210/ })).toHaveAttribute("href", "tel:+919876543210");
  expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await admin.getByLabel("Devotee who will follow up").selectOption({ label: DEVOTEE.name });
  await expect(admin.locator(".facts")).toContainText(DEVOTEE.name);
});

test("the devotee signs in and finds the assignment through a notification", async () => {
  await signIn(devotee, DEVOTEE.email, devoteeTempPassword);
  await choosePassword(devotee, devoteeTempPassword, DEVOTEE.password);
  await expect(devotee.getByRole("heading", { name: "My sevaks" })).toBeVisible();
  await expect(devotee.locator(".rows-count")).toHaveText("1 pledge");

  await devotee.getByRole("link", { name: "Notifications, 1 unread" }).click();
  await devotee.getByRole("button", { name: /A sevak has been assigned to you/ }).click();
  await expect(devotee.getByRole("heading", { name: SEVAK.name })).toBeVisible();
  await expect(devotee.getByRole("link", { name: "Notifications, 0 unread" })).toBeVisible();
});

test("the devotee logs follow-ups and the status follows", async () => {
  const form = devotee.getByRole("form", { name: "Log a follow-up" });
  await expect(devotee.getByRole("form", { name: "Record a payment" })).toHaveCount(0);

  await form.getByText("Call back later").click();
  await form.getByRole("button", { name: "Save follow-up" }).click();
  await expect(form.getByRole("alert")).toHaveText("Choose when to call back.");

  await form.getByLabel("Call back on").fill("2030-01-15T18:30");
  await form.getByLabel("Notes").fill("Busy at work this week");
  await form.getByRole("button", { name: "Save follow-up" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved. The pledge is now contacted.");
  await expect(devotee.locator(".detail-sub .badge")).toHaveText("Contacted");

  await form.getByText("Confirmed seva").click();
  await form.getByRole("button", { name: "Save follow-up" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved. The pledge is now confirmed.");
  await expect(devotee.locator(".detail-sub .badge")).toHaveText("Confirmed");
});

test("the devotee records a payment and gets a receipt number", async () => {
  const form = devotee.getByRole("form", { name: "Record a payment" });
  await expect(form.getByLabel("Amount (₹)")).toHaveValue(String(SEVAK.amount));
  await form.getByLabel(/Reference/).fill("UPI-123456");
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(form.getByRole("status")).toContainText(/Receipt NS-\d{4}-000001/);

  const history = devotee.locator(".timeline");
  await expect(history.locator("li")).toHaveCount(3);
  await expect(history).toContainText("UPI-123456");
  await expect(history).toContainText("Busy at work this week");
});

test("the devotee can't reach admin pages or other pledges", async () => {
  await expect(nav(devotee, "Reports")).toHaveCount(0);
  await devotee.goto("/portal/#/reports");
  await expect(devotee.getByRole("heading", { name: "Page not found" })).toBeVisible();

  expect((await devotee.request.get(`${API_URL}/api/reports/summary`)).status()).toBe(403);
  expect((await devotee.request.get(`${API_URL}/api/users`)).status()).toBe(403);

  const legacy = await (await admin.request.get(`${API_URL}/api/pledges?q=Legacy`)).json();
  const legacyId = legacy.data.items[0]._id;
  expect((await devotee.request.get(`${API_URL}/api/pledges/${legacyId}`)).status()).toBe(404);
  await devotee.goto(`/portal/#/pledges/${legacyId}`);
  await expect(devotee.getByRole("alert")).toHaveText("Pledge not found.");
});

test("the admin sees the money and activity in the dashboard and reports", async () => {
  await nav(admin, "Dashboard").click();
  await expect(admin.locator(".stat-card", { hasText: "Committed each month" }).locator("strong")).toHaveText("₹1,100");
  await expect(admin.locator(".stat-card", { hasText: "Collected in" }).locator("strong")).toHaveText("₹1,100");
  await expect(admin.locator(".stat-card", { hasText: "Waiting for a devotee" }).locator("strong")).toHaveText("1");

  await nav(admin, "Reports").click();
  await expect(admin.getByRole("row", { name: /₹1,100/ })).toBeVisible();
  const activity = admin.getByRole("row", { name: new RegExp(DEVOTEE.name) });
  await expect(activity.locator("td").nth(1)).toHaveText("2");
  await expect(activity.locator("td").nth(4)).toHaveText("1");

  const [download] = await Promise.all([
    admin.waitForEvent("download"),
    admin.getByRole("link", { name: /Download all pledges/ }).click(),
  ]);
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain(SEVAK.name);
  expect(csv).toContain("Legacy Devotee");
  expect(csv).toContain(`${SEVAK.amount},confirmed,${DEVOTEE.name}`);
});

const publicStats = async (page) => (await page.request.get(`${API_URL}/api/stats`)).json();

test("a fake entry is marked as not genuine and drops off the counter", async () => {
  const submitted = await admin.request.post(`${API_URL}/api/submit`, {
    data: { name: "Spam Bot", phone: "9123456789", amount: "999", consent: "yes", message: "", submittedFrom: WEB_URL },
  });
  expect(submitted.ok()).toBe(true);
  expect(await publicStats(admin)).toMatchObject({ totalPledged: 501 + 1100 + 999, totalSewaks: 3 });

  await nav(admin, "Pledges").click();
  await admin.getByRole("link", { name: /Spam Bot/ }).click();
  const form = admin.getByRole("form", { name: "Mark as not genuine" });
  await form.getByLabel("Reason").selectOption("spam");
  await form.getByLabel(/Note/).fill("Number doesn't exist");
  await form.getByRole("button", { name: "Mark as not genuine" }).click();
  await expect(admin.locator(".p-banner-flag")).toContainText("Marked as not genuine: Spam.");
  await expect(admin.locator(".p-banner-flag")).toContainText("Number doesn't exist");
  await expect(admin.getByText("payments can't be recorded")).toBeVisible();

  expect(await publicStats(admin)).toMatchObject({ totalPledged: 501 + 1100, totalSewaks: 2 });

  await nav(admin, "Pledges").click();
  await expect(admin.locator(".rows-count")).toHaveText("2 pledges");
  await admin.getByRole("tab", { name: "Not genuine" }).click();
  await expect(admin.locator(".rows-count")).toHaveText("1 pledge");
  await expect(admin.getByRole("link", { name: /Spam Bot/ })).toContainText("Spam");
});

test("an admin hides a real pledge and adjusts the counter by hand", async () => {
  await nav(admin, "Pledges").click();
  await admin.getByRole("link", { name: /Legacy Devotee/ }).click();
  await admin.getByLabel("Count this pledge on the website counter").uncheck();
  await expect(admin.locator(".p-banner")).toContainText("Hidden from the public counter.");
  expect(await publicStats(admin)).toMatchObject({ totalPledged: 1100, totalSewaks: 1 });

  await nav(admin, "Counter").click();
  await expect(admin.getByTestId("displayed-amount")).toHaveText("₹1,100");
  await expect(admin.getByTestId("displayed-sevaks")).toHaveText("1 sevak");
  await expect(admin.getByRole("link", { name: "1 pledge hidden from the counter" })).toBeVisible();
  await expect(admin.getByRole("link", { name: "1 pledge marked as not genuine" })).toBeVisible();

  const add = admin.getByRole("form", { name: "Add an adjustment" });
  await add.getByLabel(/^Label/).fill("Offline sevaks");
  await add.getByLabel(/^Amount per month/).fill("5000");
  await add.getByLabel(/^Sevaks/).fill("3");
  await add.getByRole("button", { name: "Add adjustment" }).click();
  await expect(admin.getByTestId("displayed-amount")).toHaveText("₹6,100");
  await expect(admin.getByTestId("displayed-sevaks")).toHaveText("4 sevaks");
  expect(await publicStats(admin)).toMatchObject({ totalPledged: 6100, totalSewaks: 4 });

  const row = admin.locator(".adj", { hasText: "Offline sevaks" });
  await row.getByRole("button", { name: "Pause" }).click();
  await expect(admin.getByTestId("displayed-amount")).toHaveText("₹1,100");
  await row.getByRole("button", { name: "Resume" }).click();
  await expect(admin.getByTestId("displayed-amount")).toHaveText("₹6,100");

  await row.getByRole("button", { name: "Edit" }).click();
  const edit = admin.getByRole("form", { name: "Edit adjustment" });
  await edit.getByLabel(/^Amount per month/).fill("-200");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByTestId("displayed-amount")).toHaveText("₹900");
  expect(await publicStats(admin)).toMatchObject({ totalPledged: 900, totalSewaks: 4 });

  expect((await devotee.request.get(`${API_URL}/api/counter`)).status()).toBe(403);
});

test("an admin changes the monthly goal and the website follows", async () => {
  await expect(admin.getByTestId("goal-progress")).toHaveText("1% of the ₹1,55,000 monthly goal");
  const goal = admin.getByRole("form", { name: "Monthly goal" });
  await goal.getByLabel(/^Goal per month/).fill("10000");
  await goal.getByRole("button", { name: "Save goal" }).click();
  await expect(goal.getByRole("status")).toHaveText("Saved.");
  await expect(admin.getByTestId("goal-progress")).toHaveText("9% of the ₹10,000 monthly goal");
  expect(await publicStats(admin)).toMatchObject({ totalPledged: 900, target: 10000 });

  const site = await admin.context().newPage();
  await site.goto("/");
  await site.locator(".tracker-section").scrollIntoViewIfNeeded();
  await expect(site.locator(".tracker-sub")).toHaveText("Raised of ₹10,000");
  await expect(site.locator(".tracker-stat-right")).toHaveText("₹9,100 to go");
  await site.close();

  const res = await devotee.request.put(`${API_URL}/api/counter/target`, { data: { target: 1 } });
  expect(res.status()).toBe(403);
});

test("the daily job only runs with its secret", async ({ request }) => {
  expect((await request.get(`${API_URL}/api/cron/daily`)).status()).toBe(403);
  const res = await request.get(`${API_URL}/api/cron/daily`, {
    headers: { Authorization: `Bearer ${serverEnv.CRON_SECRET}` },
  });
  expect(res.status()).toBe(200);
});

test("deactivating a devotee ends their session", async () => {
  await nav(admin, "Staff").click();
  const row = admin.getByRole("row", { name: new RegExp(DEVOTEE.name) });
  await row.getByRole("button", { name: "Deactivate" }).click();
  await expect(row).toContainText("Deactivated");

  await devotee.reload();
  await expect(devotee.getByRole("button", { name: "Sign in" })).toBeVisible();
  await signIn(devotee, DEVOTEE.email, DEVOTEE.password);
  await expect(devotee.getByRole("alert")).toHaveText("Incorrect email or password.");
});
