using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Pakpost.Api.Extensions;
using Pakpost.Api.Realtime;
using Pakpost.Api.Security;

namespace Pakpost.Api.Controllers;

/// <summary>
/// Revocable browser sessions. Separate from Google sign-in so login endpoints
/// cannot accidentally share an authorization policy with session management.
/// </summary>
[ApiController, Authorize]
[Route("api/auth")]
[RequestTimeout("auth")]
public sealed class AuthSessionsController(
    ServerSessionStore sessions, IWebHostEnvironment environment,
    WorkspaceConnectionRegistry connections, IHubContext<WorkspaceHub> hub) : ControllerBase
{
    private BrowserSession? CurrentSession() =>
        HttpContext.Items.TryGetValue(typeof(BrowserSession), out var value) ? value as BrowserSession : null;

    [Authorize, HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var name = BrowserSessionCookies.Name(Request, environment);
        var current = CurrentSession();
        var raw = HttpContext.Items.ContainsKey("pakpost_desktop_auth")
            ? Request.Headers.Authorization.ToString()["PakpostDesktop ".Length..]
            : Request.Cookies[name];
        await sessions.RevokeAsync(raw, ct);
        if (current is not null) await connections.RevokeSessionAsync(hub, current.Id);
        Response.Cookies.Delete(name, BrowserSessionCookies.Options(Request));
        return NoContent();
    }

    [Authorize, HttpPost("logout-all")]
    public async Task<IActionResult> LogoutAll(CancellationToken ct)
    {
        var name = BrowserSessionCookies.Name(Request, environment);
        await sessions.RevokeAllAsync(User.GetUserId(), ct);
        await connections.RevokeUserAsync(hub, User.GetUserId());
        Response.Cookies.Delete(name, BrowserSessionCookies.Options(Request));
        return NoContent();
    }


    [Authorize, HttpGet("sessions")]
    public async Task<ActionResult<IReadOnlyList<BrowserSessionInfo>>> ActiveSessions(CancellationToken ct)
    {
        var current = CurrentSession();
        if (current is null) return Unauthorized();
        return Ok(await sessions.ListAsync(User.GetUserId(), current.Id, ct));
    }

    [Authorize, HttpPost("sessions/{sessionId:guid}/revoke")]
    public async Task<IActionResult> RevokeSession(Guid sessionId, CancellationToken ct)
    {
        var affected = await sessions.RevokeOneAsync(User.GetUserId(), sessionId, ct);
        if (affected == 0) return NotFound();
        await connections.RevokeSessionAsync(hub, sessionId);
        if (CurrentSession()?.Id == sessionId)
            Response.Cookies.Delete(BrowserSessionCookies.Name(Request, environment), BrowserSessionCookies.Options(Request));
        return NoContent();
    }

    [Authorize, HttpPost("sessions/revoke-others")]
    public async Task<IActionResult> RevokeOthers(CancellationToken ct)
    {
        var current = CurrentSession();
        if (current is null) return Unauthorized();
        await sessions.RevokeOthersAsync(User.GetUserId(), current.Id, ct);
        await connections.RevokeOtherSessionsAsync(hub, User.GetUserId(), current.Id);
        return NoContent();
    }

}
