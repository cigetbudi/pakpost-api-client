using Microsoft.AspNetCore.Http;

namespace Pakpost.Api.Security;

// Cross-origin WebSockets must not be allowed to reuse a same-site cookie.
// Every unsafe cookie-authenticated operation also requires an unguessable
// per-session CSRF proof, never stored in browser storage.
public sealed class BrowserSessionSecurityMiddleware(
    RequestDelegate next, IConfiguration configuration)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var request = context.Request;
        var unsafeMethod = !HttpMethods.IsGet(request.Method) &&
            !HttpMethods.IsHead(request.Method) && !HttpMethods.IsOptions(request.Method);
        var hub = request.Path.StartsWithSegments("/hubs/workspace");
        if ((unsafeMethod && request.Path.StartsWithSegments("/api")) || hub)
        {
            var origin = request.Headers.Origin.ToString();
            if (!string.IsNullOrEmpty(origin) && !IsTrustedOrigin(origin, request, configuration))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }
            if (hub && (request.HttpContext.WebSockets.IsWebSocketRequest ||
                request.Headers.Upgrade.ToString().Equals("websocket", StringComparison.OrdinalIgnoreCase)) &&
                (string.IsNullOrEmpty(origin) || !IsTrustedOrigin(origin, request, configuration)))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }
        }
        if (unsafeMethod && (request.Path.StartsWithSegments("/api") || hub) &&
            context.Items.TryGetValue(typeof(BrowserSession), out var current) && current is BrowserSession session)
        {
            // Credential endpoints rotate the session and are origin-checked above.
            var authPath = request.Path.Value ?? "";
            var login = authPath is "/api/auth/login" or "/api/auth/register" or "/api/auth/google";
            if (!login && !context.Items.ContainsKey("pakpost_desktop_auth") && !ServerSessionStore.VerifyCsrf(session,
                request.Headers["X-PakPost-CSRF"].ToString()))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "CSRF proof missing or invalid" });
                return;
            }
        }
        await next(context);
    }

    internal static bool IsTrustedOrigin(string origin, HttpRequest request, IConfiguration configuration)
    {
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
            uri.AbsolutePath != "/" || !string.IsNullOrEmpty(uri.Query) ||
            !string.IsNullOrEmpty(uri.Fragment) || uri.Scheme is not ("http" or "https")) return false;
        var normalized = uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
        var own = $"{request.Scheme}://{request.Host}".TrimEnd('/');
        return string.Equals(normalized, own, StringComparison.OrdinalIgnoreCase) ||
            (configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
            .Any(allowed => string.Equals(allowed.TrimEnd('/'), normalized, StringComparison.OrdinalIgnoreCase));
    }
}
