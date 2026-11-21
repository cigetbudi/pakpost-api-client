using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pakpost.Api.Extensions;
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
    public sealed record AcceptRequest(string Token);
    public sealed record CreatorInvitationDto(Guid Id, string Email, DateTimeOffset SentAt,
        DateTimeOffset ExpiresAt);

    private bool IsSelfHosted => !WorkspaceDeploymentPolicy.From(configuration).IsPublic;

    private async Task<bool> IsAdministrator(CancellationToken ct) =>
        await db.Users.AsNoTracking().AnyAsync(u => u.Id == User.GetUserId() &&
            u.IsSuperAdmin && !u.IsDisabled, ct);

    private static string? NormalizeEmail(string? raw)
    {
        var email = raw?.Trim();
        if (string.IsNullOrWhiteSpace(email) || email.Length > 254 ||
            email.Contains('\r') || email.Contains('\n') ||
            !MailAddress.TryCreate(email, out var parsed) ||
            !string.Equals(parsed.Address, email, StringComparison.OrdinalIgnoreCase)) return null;
        return email.ToLowerInvariant();
    }

    private static string NewToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    private string BuildLink(string token)
    {
        var baseUrl = configuration["Invitations:FrontendBaseUrl"];
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var url) ||
            (url.Scheme != Uri.UriSchemeHttps && !(url.Scheme == Uri.UriSchemeHttp && url.IsLoopback)) ||
            !string.IsNullOrEmpty(url.UserInfo) ||
            !string.IsNullOrEmpty(url.Query) || !string.IsNullOrEmpty(url.Fragment))
            throw new InvalidOperationException("Configure Invitations:FrontendBaseUrl to the PakPost HTTPS frontend URL");
        return new Uri(url, $"?creatorInvite={Uri.EscapeDataString(token)}").ToString();
    }

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
        var email = NormalizeEmail(request.Email);
        if (email is null) return BadRequest(new { message = "Enter a valid email address" });
        if (await db.Users.AsNoTracking().AnyAsync(u => u.Email == email, ct))
            return Conflict(new { message = "This user already exists. Use Grant creator instead." });
        var now = DateTimeOffset.UtcNow;
        if (await db.PlatformCreatorInvitations.AsNoTracking().AnyAsync(i => i.Email == email &&
            i.AcceptedAt == null && i.RevokedAt == null && i.ExpiresAt > now, ct))
            return Conflict(new { message = "An invitation is already pending for this email. Use Resend." });

        var token = NewToken();
        var link = BuildLink(token);
        var invite = new PlatformCreatorInvitation(User.GetUserId(), email, Hash(token), now);
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
        var token = NewToken();
        var link = BuildLink(token);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        invite.Resend(Hash(token), now); // old link becomes invalid after commit
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

    [HttpPost("accept"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Accept(AcceptRequest request, CancellationToken ct)
    {
        if (!IsSelfHosted) return BadRequest(new { message = "Creator invitations are not required in Public mode" });
        if (request.Token is null || !Regex.IsMatch(request.Token, "^[A-Za-z0-9_-]{43}$"))
            return BadRequest(new { message = "Invalid or expired invitation" });
        var hash = Hash(request.Token);
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
