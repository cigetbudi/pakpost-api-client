using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Configurations;
public sealed class WorkspaceInvitationConfiguration:IEntityTypeConfiguration<WorkspaceInvitation>
{
    public void Configure(EntityTypeBuilder<WorkspaceInvitation> b)
    {
        b.ToTable("workspace_invitations","organization");
        b.HasKey(x=>x.Id);
        b.Property(x=>x.Version).IsConcurrencyToken().HasDefaultValue(1);
        b.Property(x=>x.Email).HasMaxLength(255).IsRequired();
        b.Property(x=>x.RolesJson).HasColumnType("jsonb").IsRequired();
        b.Property(x=>x.TokenHash).HasMaxLength(64).IsRequired();
        b.HasIndex(x=>x.TokenHash).IsUnique();
        b.HasIndex(x=>new{x.WorkspaceId,x.Email});
        b.HasOne<Workspace>().WithMany().HasForeignKey(x=>x.WorkspaceId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(x=>x.InvitedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
