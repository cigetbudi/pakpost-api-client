using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Configurations;

public sealed class PlatformCreatorInvitationConfiguration : IEntityTypeConfiguration<PlatformCreatorInvitation>
{
    public void Configure(EntityTypeBuilder<PlatformCreatorInvitation> b)
    {
        b.ToTable("platform_creator_invitations", "auth");
        b.HasKey(x => x.Id);
        b.Property(x => x.Email).HasMaxLength(255).IsRequired();
        b.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
        b.Property(x => x.Version).HasDefaultValue(1).IsConcurrencyToken();
        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasIndex(x => new { x.Email, x.ExpiresAt });
        b.HasOne<User>().WithMany().HasForeignKey(x => x.InvitedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
