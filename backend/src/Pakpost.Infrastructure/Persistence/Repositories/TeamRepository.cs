using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class TeamRepository(PakpostDbContext db) : ITeamRepository
{
    public Task<Team?> FindAsync(Guid id, CancellationToken ct) =>
        db.Teams.FirstOrDefaultAsync(team => team.Id == id, ct);

    public async Task<IReadOnlyList<Team>> ListAsync(Guid workspaceId, CancellationToken ct) =>
        await db.Teams
            .AsNoTracking()
            .Where(team => team.WorkspaceId == workspaceId)
            .OrderBy(team => team.Name)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<TeamMember>> ListMembersAsync(Guid id, CancellationToken ct) =>
        await db.TeamMembers
            .AsNoTracking()
            .Where(member => member.TeamId == id)
            .OrderBy(member => member.JoinedAt)
            .ToListAsync(ct);

    public Task<bool> HasMemberAsync(Guid id, Guid userId, CancellationToken ct) =>
        db.TeamMembers.AnyAsync(member => member.TeamId == id && member.UserId == userId, ct);

    public void Add(Team team) => db.Teams.Add(team);

    public void AddMember(TeamMember member) => db.TeamMembers.Add(member);
}
