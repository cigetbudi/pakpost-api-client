using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.Extensions.Configuration;
using Pakpost.Application.Internal.Auth.Commands;
using Pakpost.Application.Internal.Auth.DTOs;
using Pakpost.Application.Internal.Auth.Queries;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pakpost.Api.Extensions;
using Pakpost.Api.Security;
using Pakpost.Api.Realtime;
using Microsoft.AspNetCore.SignalR;

namespace Pakpost.Api.Controllers;

public sealed record GoogleLinkRequest(string Credential, string Password);
public sealed record BrowserLoginResponse(UserProfile User, DateTimeOffset ExpiresAt, string CsrfToken);
public sealed record BrowserSessionResponse(bool Authenticated, UserProfile? User, DateTimeOffset? ExpiresAt, string? CsrfToken);

[ApiController]
[Route("api/auth")]
[RequestTimeout("auth")]
public sealed class AuthController(
    ISender sender, ServerSessionStore sessions, IWebHostEnvironment environment,
    WorkspaceConnectionRegistry connections, IHubContext<WorkspaceHub> hub, IConfiguration configuration) : ControllerBase
{
    private bool InsecureDeployment => !Request.IsHttps && !environment.IsDevelopment();
    private ActionResult<BrowserLoginResponse> HttpsRequired() =>
        StatusCode(StatusCodes.Status403Forbidden,
            new { message = "HTTPS is required for browser session cookies" });

    private async Task<ActionResult<BrowserLoginResponse>> EstablishSession(LoginResult result, CancellationToken ct)
    {
        // The existing login handler still constructs an internal JWT, which is
        // deliberately discarded and never serialized to the browser.
        var name = BrowserSessionCookies.Name(Request, environment);
        var old = await sessions.FindAsync(Request.Cookies[name], ct);
        await sessions.RevokeAsync(Request.Cookies[name], ct); // Rotate on every login.
        if (old is not null) await connections.RevokeSessionAsync(hub, old.Id);
        var fresh = await sessions.CreateAsync(result.User.Id, ct, Request.Headers.UserAgent.ToString(), result.User.AvatarUrl);
        Response.Cookies.Append(name, fresh.OpaqueToken, BrowserSessionCookies.Options(Request));
        return Ok(new BrowserLoginResponse(result.User, fresh.ExpiresAt, fresh.CsrfToken));
    }

    // Legacy route kept as an explicit rejection for older clients.
    // Google sign-in creates accounts on first use; password registration is disabled.
    [HttpPost("register"), AllowAnonymous, EnableRateLimiting("auth")]
    public IActionResult Register() => StatusCode(StatusCodes.Status410Gone,
        new { message = "Password registration is disabled. Continue with Google." });

    [HttpPost("login"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<ActionResult<BrowserLoginResponse>> Login(LoginCommand request, CancellationToken ct)
    {
        // Only for migrating accounts created before Google-only sign-in.
        // Never enable on an internet-facing deployment longer than needed.
        if (!configuration.GetValue<bool>("Authentication:EnableLegacyPasswordLogin"))
            return StatusCode(StatusCodes.Status410Gone,
                new { message = "Password sign-in is disabled. Continue with Google." });
        if (InsecureDeployment) return HttpsRequired();
        return await EstablishSession(await sender.Send(request, ct), ct);
    }

    [HttpPost("google"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<ActionResult<BrowserLoginResponse>> Google(GoogleLoginCommand request, CancellationToken ct)
    {
        if (InsecureDeployment) return HttpsRequired();
        return await EstablishSession(await sender.Send(request, ct), ct);
    }

    [AllowAnonymous, HttpGet("session")]
    public async Task<ActionResult<BrowserSessionResponse>> Session(CancellationToken ct)
    {
        var raw = HttpContext.Items.ContainsKey("pakpost_desktop_auth")
            ? Request.Headers.Authorization.ToString()["PakpostDesktop ".Length..]
            : Request.Cookies[BrowserSessionCookies.Name(Request, environment)];
        var found = HttpContext.Items.TryGetValue(typeof(BrowserSession), out var cached)
            ? cached as BrowserSession : await sessions.FindAsync(raw, ct);
        if (found is null)
            return Ok(new BrowserSessionResponse(false, null, null, null));
        // Confirm this user still exists (deleting an account cascades to sessions).
        var user = await sender.Send(new GetMeQuery(found.UserId), ct);
        var csrf = sessions.CsrfProof(raw!);
        if (!ServerSessionStore.VerifyCsrf(found, csrf))
            return Unauthorized();
        return Ok(new BrowserSessionResponse(true, user with { AvatarUrl = found.AvatarUrl }, found.ExpiresAt, csrf));
    }

    private BrowserSession? CurrentSession() =>
        HttpContext.Items.TryGetValue(typeof(BrowserSession), out var value) ? value as BrowserSession : null;

    [Authorize, HttpPost("google/link"), EnableRateLimiting("auth")]
    public async Task<ActionResult<GoogleLinkResult>> LinkGoogle(GoogleLinkRequest request, CancellationToken ct)
        => Ok(await sender.Send(new GoogleLinkCommand(User.GetUserId(), request.Credential, request.Password), ct));

    [Authorize, HttpGet("google/status")]
    public async Task<ActionResult<GoogleConnectionStatus>> GoogleStatus(CancellationToken ct)
        => Ok(await sender.Send(new GoogleConnectionStatusQuery(User.GetUserId()), ct));

    [Authorize, HttpGet("me")]
    public async Task<ActionResult<UserProfile>> Me(CancellationToken ct)
    {
        var user = await sender.Send(new GetMeQuery(User.GetUserId()), ct);
        return Ok(user with { AvatarUrl = CurrentSession()?.AvatarUrl });
    }
}
