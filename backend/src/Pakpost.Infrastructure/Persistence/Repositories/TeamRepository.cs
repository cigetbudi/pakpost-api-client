using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Repositories;
public sealed class TeamRepository(PakpostDbContext db):ITeamRepository
{
    public Task<Team?> FindAsync(Guid id,CancellationToken ct)=>db.Teams.FirstOrDefaultAsync(x=>x.Id==id,ct);
    public async Task<IReadOnlyList<Team>> ListAsync(Guid wid,CancellationToken ct)=>
        await db.Teams.AsNoTracking().Where(x=>x.WorkspaceId==wid).OrderBy(x=>x.Name).ToListAsync(ct);
    public async Task<IReadOnlyList<TeamMember>> ListMembersAsync(Guid id,CancellationToken ct)=>
        await db.TeamMembers.AsNoTracking().Where(x=>x.TeamId==id).OrderBy(x=>x.JoinedAt).ToListAsync(ct);
    public Task<bool> HasMemberAsync(Guid id,Guid uid,CancellationToken ct)=>db.TeamMembers.AnyAsync(x=>x.TeamId==id && x.UserId==uid,ct);
    public void Add(Team t)=>db.Teams.Add(t);
    public void AddMember(TeamMember t)=>db.TeamMembers.Add(t);
}
