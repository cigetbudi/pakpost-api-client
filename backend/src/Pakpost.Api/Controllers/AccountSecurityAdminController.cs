using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Pakpost.Api.Extensions;
using Pakpost.Api.Realtime;
using Pakpost.Infrastructure.Persistence;

namespace Pakpost.Api.Controllers;

// Restricted to an existing superadmin. No public endpoint grants admin roles.
[ApiController, Authorize, Route("api/admin/account-security")]
public sealed class AccountSecurityAdminController(
    PakpostDbContext db, WorkspaceConnectionRegistry connections,
    IHubContext<WorkspaceHub> hub) : ControllerBase
{
    [HttpPost("users/{userId:guid}/disable")]
    public async Task<IActionResult> Disable(Guid userId, CancellationToken ct)
        => await SetDisabled(userId, true, ct);

    [HttpPost("users/{userId:guid}/enable")]
    public async Task<IActionResult> Enable(Guid userId, CancellationToken ct)
        => await SetDisabled(userId, false, ct);

    private async Task<IActionResult> SetDisabled(Guid userId, bool disabled, CancellationToken ct)
    {
        var actorId = User.GetUserId();
        var actor = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == actorId && !u.IsDisabled, ct);
        if (actor is null || !actor.IsSuperAdmin) return Forbid();
        if (actorId == userId) return BadRequest(new { message = "Cannot change your own account status" });
        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            var target = await db.Users.SingleOrDefaultAsync(u => u.Id == userId, ct);
            if (target is null) return NotFound();
            if (target.IsSuperAdmin) return BadRequest(new { message = "Superadmin accounts cannot be disabled here" });
            target.SetDisabled(disabled);
            await db.SaveChangesAsync(ct);
            if (disabled)
                await db.UserSessions.Where(s => s.UserId == userId && s.RevokedAt == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt,
                        (DateTimeOffset?)DateTimeOffset.UtcNow), ct);
            await transaction.CommitAsync(ct);
        }
        if (disabled) await connections.RevokeUserAsync(hub, userId);
        return NoContent();
    }
}
