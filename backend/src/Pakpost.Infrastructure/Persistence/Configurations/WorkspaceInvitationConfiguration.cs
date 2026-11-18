using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Configurations;

public sealed class WorkspaceInvitationConfiguration : IEntityTypeConfiguration<WorkspaceInvitation>
{
    public void Configure(EntityTypeBuilder<WorkspaceInvitation> builder)
    {
        builder.ToTable("workspace_invitations", "organization");
        builder.HasKey(invitation => invitation.Id);

        builder.Property(invitation => invitation.Version)
            .IsConcurrencyToken()
            .HasDefaultValue(1);

        builder.Property(invitation => invitation.Email).HasMaxLength(255).IsRequired();
        builder.Property(invitation => invitation.RolesJson).HasColumnType("jsonb").IsRequired();
        builder.Property(invitation => invitation.TokenHash).HasMaxLength(64).IsRequired();

        builder.HasIndex(invitation => invitation.TokenHash).IsUnique();
        builder.HasIndex(invitation => new { invitation.WorkspaceId, invitation.Email });

        builder.HasOne<Workspace>()
            .WithMany()
            .HasForeignKey(invitation => invitation.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(invitation => invitation.InvitedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
