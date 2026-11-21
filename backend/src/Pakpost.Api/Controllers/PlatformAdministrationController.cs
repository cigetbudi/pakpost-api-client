using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pakpost.Api.Extensions;
using Pakpost.Application.Common.Security;
using Pakpost.Infrastructure.Persistence;

namespace Pakpost.Api.Controllers;

// Platform permissions are independent of membership in any workspace.
// Never expose environment secrets or collections through instance admin APIs.
[ApiController, Authorize, Route("api/admin/platform")]
public sealed class PlatformAdministrationController(PakpostDbContext db, IConfiguration configuration)
    : ControllerBase
{
    public sealed record ChangeCreatorRequest(bool Enabled);
    public sealed record PlatformUserDto(Guid Id, string Email, string DisplayName,
        bool IsDisabled, bool IsSuperAdmin, bool CanCreateWorkspaces);
    public sealed record PlatformUsersPage(IReadOnlyList<PlatformUserDto> Items,
        int Page, int PageSize, int Total);

    private async Task<bool> IsAdministrator(CancellationToken ct) =>
        await db.Users.AsNoTracking().AnyAsync(user =>
            user.Id == User.GetUserId() && user.IsSuperAdmin && !user.IsDisabled, ct);

    [HttpGet("policy")]
    public async Task<IActionResult> Policy(CancellationToken ct)
    {
        if (!await IsAdministrator(ct)) return Forbid();
        var policy = WorkspaceDeploymentPolicy.From(configuration);
        return Ok(new { deploymentMode = policy.Mode, maxMembersPerWorkspace = policy.MaxMembers,
            creationPolicy = policy.IsPublic ? "Authenticated" : "AdminApproved" });
    }

    [HttpGet("users")]
    public async Task<ActionResult<PlatformUsersPage>> UsersList(
        [FromQuery] string? search, [FromQuery] int page = 1, CancellationToken ct = default)
    {
        if (!await IsAdministrator(ct)) return Forbid();
        if (page < 1 || page > 100000) return BadRequest(new { message = "Invalid page" });
        if (search?.Length > 100) return BadRequest(new { message = "Search too long" });

        var query = db.Users.AsNoTracking();
        var needle = search?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(needle))
            query = query.Where(user => user.Email.Contains(needle) ||
                user.DisplayName.ToLower().Contains(needle));
        var total = await query.CountAsync(ct);
        const int pageSize = 20;
        var users = await query.OrderBy(user => user.Email)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(user => new PlatformUserDto(user.Id, user.Email, user.DisplayName,
                user.IsDisabled, user.IsSuperAdmin, user.CanCreateWorkspaces))
            .ToListAsync(ct);
        return Ok(new PlatformUsersPage(users, page, pageSize, total));
    }

    [HttpPut("users/{userId:guid}/workspace-creator")]
    public async Task<IActionResult> SetWorkspaceCreator(
        Guid userId, [FromBody] ChangeCreatorRequest request, CancellationToken ct)
    {
        if (!await IsAdministrator(ct)) return Forbid();
        if (WorkspaceDeploymentPolicy.From(configuration).IsPublic)
            return BadRequest(new { message = "All Google users can create workspaces in Public mode" });

        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return NotFound();
        if (user.IsDisabled && request.Enabled)
            return BadRequest(new { message = "Enable this account before granting Workspace Creator" });
        user.SetWorkspaceCreation(request.Enabled);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
