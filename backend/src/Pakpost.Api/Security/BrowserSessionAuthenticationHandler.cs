using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Pakpost.Api.Security;

public sealed class BrowserSessionAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger, UrlEncoder encoder,
    ServerSessionStore sessions, IWebHostEnvironment environment)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string Scheme = "PakpostSession";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // Liveness/readiness must not require DB session resolution.
        if (Request.Path.StartsWithSegments("/health")) return AuthenticateResult.NoResult();
        var raw = Request.Cookies[BrowserSessionCookies.Name(Request, environment)];
        if (string.IsNullOrEmpty(raw)) return AuthenticateResult.NoResult();
        var session = await sessions.FindAsync(raw, Context.RequestAborted);
        if (session is null) return AuthenticateResult.Fail("Session expired or revoked");
        Context.Items[typeof(BrowserSession)] = session;
        var claims = new[] { new Claim("sub", session.UserId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, session.UserId.ToString()) };
        var identity = new ClaimsIdentity(claims, Scheme);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity),
            new AuthenticationProperties { ExpiresUtc = session.ExpiresAt }, Scheme));
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
