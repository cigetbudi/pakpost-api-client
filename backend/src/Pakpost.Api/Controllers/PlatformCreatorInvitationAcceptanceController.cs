using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pakpost.Api.Extensions;
using Pakpost.Api.Security;
using Pakpost.Application.Common.Security;
using Pakpost.Infrastructure.Persistence;

namespace Pakpost.Api.Controllers;

/// <summary>
/// A signed-in Google identity can redeem an invite, but this controller
/// never exposes the administrator-only invitation management operations.
/// The same PostgreSQL transaction and compare-and-set update remain in use.
/// </summary>
[ApiController, Authorize]
[Route("api/admin/platform/creator-invitations")]
public sealed class PlatformCreatorInvitationAcceptanceController(PakpostDbContext db,
    IConfiguration configuration) : ControllerBase
{
    public sealed record AcceptRequest(string Token);
    private bool IsSelfHosted => !WorkspaceDeploymentPolicy.From(configuration).IsPublic;
    [HttpPost("accept"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Accept(AcceptRequest request, CancellationToken ct)
    {
        if (!IsSelfHosted) return BadRequest(new { message = "Creator invitations are not required in Public mode" });
        if (request.Token is null || !Regex.IsMatch(request.Token, "^[A-Za-z0-9_-]{43}$"))
            return BadRequest(new { message = "Invalid or expired invitation" });
        var hash = PlatformCreatorInvitationTokens.Hash(request.Token);
        var now = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var invitation = await db.PlatformCreatorInvitations.AsNoTracking()
            .SingleOrDefaultAsync(i => i.TokenHash == hash, ct);
        if (invitation is null || !invitation.IsPending(now))
            return BadRequest(new { message = "Invalid or expired invitation" });

        // Disabling or demoting the inviting admin invalidates outstanding approvals.
        if (!await db.Users.AsNoTracking().AnyAsync(u => u.Id == invitation.InvitedByUserId &&
            u.IsSuperAdmin && !u.IsDisabled, ct))
            return BadRequest(new { message = "Invitation is no longer authorized" });

        var userId = User.GetUserId();
        var validIdentity = await db.Users.AsNoTracking().AnyAsync(u =>
            u.Id == userId && !u.IsDisabled && u.Email == invitation.Email, ct) &&
            await db.UserExternalIdentities.AsNoTracking().AnyAsync(i =>
                i.UserId == userId && i.Provider == "google", ct);
        if (!validIdentity)
            return StatusCode(403, new { message = "Sign in with the Google-verified email that received this invitation" });

        // Atomic, single-use consumption. Two simultaneous accepts cannot both succeed.
        var claimed = await db.PlatformCreatorInvitations
            .Where(i => i.Id == invitation.Id && i.TokenHash == hash &&
                i.AcceptedAt == null && i.RevokedAt == null && i.ExpiresAt > now)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(i => i.AcceptedAt, (DateTimeOffset?)now)
                .SetProperty(i => i.Version, i => i.Version + 1), ct);
        if (claimed != 1) return Conflict(new { message = "Invitation has already been used" });

        var enabled = await db.Users.Where(u => u.Id == userId && !u.IsDisabled && u.Email == invitation.Email)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(u => u.CanCreateWorkspaces, true)
                .SetProperty(u => u.UpdatedAt, now), ct);
        if (enabled != 1) return StatusCode(403, new { message = "Account unavailable" });
        await transaction.CommitAsync(ct);
        return Ok(new { canCreateWorkspace = true });
    }
}
