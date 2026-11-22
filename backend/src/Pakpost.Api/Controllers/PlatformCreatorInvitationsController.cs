using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pakpost.Api.Extensions;
using Pakpost.Api.Security;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Infrastructure.Persistence;

namespace Pakpost.Api.Controllers;

/// <summary>
/// Platform invitations grant only workspace creation. They never create workspace
/// membership and cannot be accepted with an unverified email or password login.
/// </summary>
[ApiController, Authorize, Route("api/admin/platform/creator-invitations")]
public sealed class PlatformCreatorInvitationsController(
    PakpostDbContext db, IConfiguration configuration,
    IPlatformCreatorInvitationEmailSender emailSender) : ControllerBase
{
    public sealed record InviteRequest(string Email);
    public sealed record CreatorInvitationDto(Guid Id, string Email, DateTimeOffset SentAt,
        DateTimeOffset ExpiresAt);

    private bool IsSelfHosted => !WorkspaceDeploymentPolicy.From(configuration).IsPublic;

    private async Task<bool> IsAdministrator(CancellationToken ct) =>
        await db.Users.AsNoTracking().AnyAsync(u => u.Id == User.GetUserId() &&
            u.IsSuperAdmin && !u.IsDisabled, ct);

    private static CreatorInvitationDto ToDto(PlatformCreatorInvitation i) =>
        new(i.Id, i.Email, i.SentAt, i.ExpiresAt);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CreatorInvitationDto>>> List(CancellationToken ct)
    {
        if (!await IsAdministrator(ct)) return Forbid();
        if (!IsSelfHosted) return Ok(Array.Empty<CreatorInvitationDto>());
        var now = DateTimeOffset.UtcNow;
        var rows = await db.PlatformCreatorInvitations.AsNoTracking()
            .Where(i => i.AcceptedAt == null && i.RevokedAt == null && i.ExpiresAt > now)
            .OrderByDescending(i => i.SentAt).Take(100)
            .Select(i => new CreatorInvitationDto(i.Id, i.Email, i.SentAt, i.ExpiresAt))
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost, EnableRateLimiting("auth")]
    public async Task<ActionResult<CreatorInvitationDto>> Invite(InviteRequest request, CancellationToken ct)
    {
        if (!await IsAdministrator(ct)) return Forbid();
        if (!IsSelfHosted) return BadRequest(new { message = "Creator invitations are only available in Self-Hosted mode" });
        var email = PlatformCreatorInvitationTokens.NormalizeEmail(request.Email);
        if (email is null) return BadRequest(new { message = "Enter a valid email address" });
        if (await db.Users.AsNoTracking().AnyAsync(u => u.Email == email, ct))
            return Conflict(new { message = "This user already exists. Use Grant creator instead." });
        var now = DateTimeOffset.UtcNow;
        if (await db.PlatformCreatorInvitations.AsNoTracking().AnyAsync(i => i.Email == email &&
            i.AcceptedAt == null && i.RevokedAt == null && i.ExpiresAt > now, ct))
            return Conflict(new { message = "An invitation is already pending for this email. Use Resend." });

        var token = PlatformCreatorInvitationTokens.NewToken();
        var link = PlatformCreatorInvitationTokens.BuildLink(token, configuration);
        var invite = new PlatformCreatorInvitation(User.GetUserId(), email, PlatformCreatorInvitationTokens.Hash(token), now);
        // If SMTP fails, the DB insert is rolled back. No secret is returned in the API.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.PlatformCreatorInvitations.Add(invite);
        await db.SaveChangesAsync(ct);
        await emailSender.SendAsync(email, link, ct);
        await transaction.CommitAsync(ct);
        return Ok(ToDto(invite));
    }

    [HttpPost("{id:guid}/resend"), EnableRateLimiting("auth")]
    public async Task<ActionResult<CreatorInvitationDto>> Resend(Guid id, CancellationToken ct)
    {
        if (!await IsAdministrator(ct)) return Forbid();
        if (!IsSelfHosted) return BadRequest(new { message = "Unavailable in Public mode" });
        var invite = await db.PlatformCreatorInvitations.SingleOrDefaultAsync(i => i.Id == id, ct);
        var now = DateTimeOffset.UtcNow;
        if (invite is null || !invite.IsPending(now)) return NotFound();
        if (await db.Users.AsNoTracking().AnyAsync(u => u.Email == invite.Email, ct))
            return Conflict(new { message = "User has already registered. Grant creator from the user list." });
        var token = PlatformCreatorInvitationTokens.NewToken();
        var link = PlatformCreatorInvitationTokens.BuildLink(token, configuration);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        invite.Resend(PlatformCreatorInvitationTokens.Hash(token), now); // old link becomes invalid after commit
        await db.SaveChangesAsync(ct);
        await emailSender.SendAsync(invite.Email, link, ct);
        await transaction.CommitAsync(ct);
        return Ok(ToDto(invite));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Revoke(Guid id, CancellationToken ct)
    {
        if (!await IsAdministrator(ct)) return Forbid();
        if (!IsSelfHosted) return BadRequest(new { message = "Unavailable in Public mode" });
        var invite = await db.PlatformCreatorInvitations.SingleOrDefaultAsync(i => i.Id == id, ct);
        var now = DateTimeOffset.UtcNow;
        if (invite is null || !invite.IsPending(now)) return NotFound();
        invite.Revoke(now);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
