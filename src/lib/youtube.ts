import type { OAuth2Tokens } from "better-auth";
import type { GoogleProfile } from "better-auth/social-providers";

type GoogleUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

type YouTubeChannel = {
  id: string;
  snippet: {
    title: string;
    customUrl?: string;
    thumbnails?: { default?: { url: string } };
  };
};

async function getJson<T>(url: string, accessToken: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) {
    console.error(`YouTube sign-in: ${url} -> ${res.status} ${await res.text()}`);
    return null;
  }
  return (await res.json()) as T;
}

/**
 * getUserInfo override for BetterAuth's `google` provider, which is our
 * "YouTube" login: the account is keyed by the **YouTube channel ID**
 * (returned as the profile's `sub`, which the provider's accountSubject uses
 * as account.accountId), named after the channel, with the Google account's
 * email only used for verified-email account linking.
 *
 * Returns null -- BetterAuth then redirects with ?error=unable_to_get_user_info
 * -- when the Google account has no YouTube channel.
 */
export async function youtubeUserInfo(token: OAuth2Tokens) {
  if (!token.accessToken) return null;

  const [info, channels] = await Promise.all([
    getJson<GoogleUserInfo>("https://openidconnect.googleapis.com/v1/userinfo", token.accessToken),
    getJson<{ items?: YouTubeChannel[] }>(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      token.accessToken,
    ),
  ]);
  const channel = channels?.items?.[0];
  if (!info || !channel) return null;

  const name = channel.snippet.title;
  const image = channel.snippet.thumbnails?.default?.url ?? info.picture ?? "";
  const email = info.email ?? "";
  const emailVerified = info.email_verified === true;

  return {
    user: { name, email, image, emailVerified },
    // Profile record BetterAuth derives the account key from (accountSubject
    // reads `sub`): the channel ID, not the Google account ID.
    data: {
      sub: channel.id,
      email,
      email_verified: emailVerified,
      name,
      picture: image,
    } as GoogleProfile,
  };
}
