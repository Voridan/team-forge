import { expect, test, type BrowserContext } from '@playwright/test';
import { login, openTeamChat } from './helpers/auth';

/**
 * Two-window chat E2E.
 *
 * Each test opens two independent browser contexts (so cookies, localStorage,
 * and websockets are fully isolated), logs in as different seeded users, and
 * verifies real-time delivery between them.
 *
 * Prerequisites:
 *   - Backend stack is running (./dev.sh + cd web && npm run dev)
 *   - Seed data includes Alice + Charlie as LOCAL users in the Engineering team
 *   - At least one channel exists in Engineering (create one manually if not,
 *     or extend the seed to create #general)
 */
test.describe('Realtime chat — two windows', () => {
  let aliceContext: BrowserContext;
  let charlieContext: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    aliceContext = await browser.newContext();
    charlieContext = await browser.newContext();
  });

  test.afterEach(async () => {
    await aliceContext.close();
    await charlieContext.close();
  });

  test('a message sent by Alice appears in Charlie\'s view without refresh', async () => {
    const alicePage = await aliceContext.newPage();
    const charliePage = await charlieContext.newPage();

    await login(alicePage, 'alice@example.com', 'Password123!');
    await login(charliePage, 'charlie@example.com', 'Password123!');

    await openTeamChat(alicePage);
    await openTeamChat(charliePage);

    // Both clients should now have a WS connection to /ws. Give the
    // RealtimeProvider a tick to register listeners after route mount.
    await alicePage.waitForTimeout(500);

    const unique = `Hello from Alice ${Date.now()}`;

    await alicePage
      .getByRole('textbox', { name: /^message #/i })
      .fill(unique);
    await alicePage.keyboard.press('Enter');

    // Charlie should see the message arrive via WS, no manual refetch.
    await expect(charliePage.getByText(unique)).toBeVisible({ timeout: 5_000 });
  });

  test('Charlie sees Alice\'s "typing…" indicator', async () => {
    const alicePage = await aliceContext.newPage();
    const charliePage = await charlieContext.newPage();

    await login(alicePage, 'alice@example.com', 'Password123!');
    await login(charliePage, 'charlie@example.com', 'Password123!');

    await openTeamChat(alicePage);
    await openTeamChat(charliePage);
    await alicePage.waitForTimeout(500);

    await alicePage.getByRole('textbox', { name: /^message #/i }).fill('hmm');

    await expect(
      charliePage.getByText(/Alice is typing/i),
    ).toBeVisible({ timeout: 4_000 });
  });

  test('Charlie sees a green presence dot on Alice\'s avatar', async () => {
    const alicePage = await aliceContext.newPage();
    const charliePage = await charlieContext.newPage();

    await login(alicePage, 'alice@example.com', 'Password123!');
    await login(charliePage, 'charlie@example.com', 'Password123!');

    // Alice writes the first message so her avatar renders in Charlie's thread.
    await openTeamChat(alicePage);
    await alicePage
      .getByRole('textbox', { name: /^message #/i })
      .fill(`Hello ${Date.now()}`);
    await alicePage.keyboard.press('Enter');

    await openTeamChat(charliePage);
    await charliePage.waitForTimeout(500);

    // The dot is a small absolutely-positioned span with aria-label="Online".
    await expect(
      charliePage.getByLabel(/^Online$/i).first(),
    ).toBeVisible({ timeout: 4_000 });
  });
});
