using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Pakpost.Api.Security;

public sealed class BrowserSessionAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger, UrlEncoder encoder,
    ServerSessionStore sessions, IWebHostEnvironment environment, IConfiguration configuration)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "PakpostSession";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // Liveness/readiness must not require DB session resolution.
        if (Request.Path.StartsWithSegments("/health")) return AuthenticateResult.NoResult();
        // Desktop uses a distinct, explicit opaque-token scheme. Reject JWTs and
        // never accept a desktop header together with a browser cookie.
        var desktop = Request.Headers.Authorization.ToString();
        var cookie = Request.Cookies[BrowserSessionCookies.Name(Request, environment)];
        string? raw;
        if (desktop.StartsWith("PakpostDesktop ", StringComparison.Ordinal))
        {
            // Emergency kill switch must reject previously issued desktop sessions too.
            if (!configuration.GetValue<bool>("DesktopAuth:Enabled"))
                return AuthenticateResult.Fail("Desktop authentication disabled");
            if (!string.IsNullOrEmpty(cookie)) return AuthenticateResult.Fail("Mixed authentication modes");
            raw = desktop["PakpostDesktop ".Length..];
            Context.Items["pakpost_desktop_auth"] = true;
        }
        else
        {
            if (!string.IsNullOrEmpty(desktop)) return AuthenticateResult.Fail("Unsupported authorization scheme");
            raw = cookie;
        }
        if (string.IsNullOrEmpty(raw)) return AuthenticateResult.NoResult();
        var session = await sessions.FindAsync(raw, Context.RequestAborted);
        if (session is null) return AuthenticateResult.Fail("Session expired or revoked");
        Context.Items[typeof(BrowserSession)] = session;
        var claims = new[] { new Claim("sub", session.UserId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, session.UserId.ToString()),
            new Claim("pakpost_session_id", session.Id.ToString()) };
        var identity = new ClaimsIdentity(claims, SchemeName);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity),
            new AuthenticationProperties { ExpiresUtc = session.ExpiresAt }, SchemeName));
    }
}

public static class BrowserSessionCookies
{
    public static string Name(HttpRequest request, IWebHostEnvironment environment) =>
        request.IsHttps ? "__Host-pakpost_session" :
        environment.IsDevelopment() ? "pakpost_dev_session" : "__Host-pakpost_session";

    public static CookieOptions Options(HttpRequest request) => new()
    {
        HttpOnly = true, Secure = request.IsHttps,
        SameSite = SameSiteMode.Lax, Path = "/", IsEssential = true
        // No MaxAge/Expires: session cookie, while the DB enforces an absolute expiry.
    };
}
