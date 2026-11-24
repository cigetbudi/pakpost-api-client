
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pakpost.Api.Extensions;
using Pakpost.Api.Security;

namespace Pakpost.Api.Controllers;

[ApiController]
[Route("api/desktop-auth")]
public sealed class DesktopAuthController(
    DesktopPairingStore pairing,
    ServerSessionStore sessions,
    IConfiguration configuration
) : ControllerBase
{
    private bool Enabled =>
        configuration.GetValue<bool>("DesktopAuth:Enabled");

    // The browser never receives the device secret.
    [HttpPost("start")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public IActionResult Start()
    {
        if (!Enabled)
            return NotFound();

        DesktopPairingStore.Started started;

        try
        {
            started = pairing.Start();
        }
        catch (InvalidOperationException)
        {
            return StatusCode(429, new
            {
                message = "Too many pending logins"
            });
        }

        Response.Headers.CacheControl = "no-store";

        return Ok(new
        {
            started.RequestId,
            started.DeviceSecret,
            started.ExpiresAt
        });
    }

    // Only authenticated browser sessions may approve a device.
    // Existing CSRF protection must remain enabled.
    [HttpPost("approve")]
    [Authorize]
    [EnableRateLimiting("auth")]
    public IActionResult Approve([FromBody] ApprovalRequest input)
    {
        if (!Enabled)
            return NotFound();

        var currentUserId = User.GetUserId();

        // Reject desktop bearer sessions.
        // Approval must come from an interactive browser session.
        if (HttpContext.Items.ContainsKey("pakpost_desktop_auth"))
            return Forbid();

        if (string.IsNullOrWhiteSpace(input.RequestId))
        {
            return BadRequest(new
            {
                message = "Pairing request ID is required"
            });
        }

        if (!HttpContext.Items.TryGetValue(typeof(BrowserSession), out var sessionValue)
            || sessionValue is not BrowserSession browserSession
            || browserSession.UserId != currentUserId)
            return Forbid();

        if (!pairing.Approve(input.RequestId, currentUserId, browserSession.AvatarUrl))
        {
            return BadRequest(new
            {
                message = "Pairing request expired, already used, or invalid"
            });
        }

        return Ok(new
        {
            approved = true
        });
    }

    // Requires the high-entropy device secret.
    [HttpPost("poll")]
    [AllowAnonymous]
    [EnableRateLimiting("desktop-poll")]
    public async Task<IActionResult> Poll(
        [FromBody] PollRequest input,
        CancellationToken ct
    )
    {
        if (!Enabled)
            return NotFound();

        var status = pairing.Consume(
            input.RequestId ?? "",
            input.DeviceSecret ?? "",
            out var userId,
            out var avatarUrl
        );

        if (status == DesktopPairingStore.Status.Invalid)
        {
            return Unauthorized(new
            {
                message = "Pairing expired or invalid"
            });
        }

        if (status == DesktopPairingStore.Status.Pending)
        {
            Response.Headers.CacheControl = "no-store";

            return Ok(new
            {
                status = "pending"
            });
        }

        var fresh = await sessions.CreateAsync(
            userId,
            ct,
            "PakPost Desktop",
            avatarUrl
        );

        Response.Headers.CacheControl = "no-store";

        // Return the session only to the requesting desktop.
        return Ok(new
        {
            status = "approved",
            desktopToken = fresh.OpaqueToken,
            fresh.ExpiresAt
        });
    }

    public sealed record ApprovalRequest(string RequestId);

    public sealed record PollRequest(
        string? RequestId,
        string? DeviceSecret
    );
}
