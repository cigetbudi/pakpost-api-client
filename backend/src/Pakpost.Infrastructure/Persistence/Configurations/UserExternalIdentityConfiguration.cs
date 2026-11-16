using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Configurations;
public sealed class UserExternalIdentityConfiguration : IEntityTypeConfiguration<UserExternalIdentity>
{
    public void Configure(EntityTypeBuilder<UserExternalIdentity> b)
    {
        b.ToTable("user_external_identities", "auth");
        b.HasKey(x => x.Id);
        b.Property(x => x.Provider).IsRequired().HasMaxLength(32);
        b.Property(x => x.Subject).IsRequired().HasMaxLength(255);
        b.HasIndex(x => new { x.Provider, x.Subject }).IsUnique();
        b.HasIndex(x => new { x.UserId, x.Provider }).IsUnique();
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
