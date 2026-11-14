using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence;
public sealed class PakpostDbContext(DbContextOptions<PakpostDbContext> options) : DbContext(options), IUnitOfWork
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<WorkspaceMember> WorkspaceMembers => Set<WorkspaceMember>();
    public DbSet<Collection> Collections => Set<Collection>();
    public DbSet<SavedRequest> SavedRequests => Set<SavedRequest>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<RequestEnvironment> RequestEnvironments => Set<RequestEnvironment>();
    public DbSet<RequestEnvironmentVariable> RequestEnvironmentVariables => Set<RequestEnvironmentVariable>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PakpostDbContext).Assembly);
    }
}
