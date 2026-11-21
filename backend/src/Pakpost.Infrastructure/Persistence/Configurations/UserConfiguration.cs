using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Configurations;
public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("users","auth"); b.HasKey(x=>x.Id);
        b.Property(x=>x.Email).HasMaxLength(255).IsRequired();
        b.Property(x=>x.DisplayName).HasMaxLength(120).IsRequired();
        b.Property(x=>x.PasswordHash).HasMaxLength(255).IsRequired();
        b.Property(x=>x.IsDisabled).HasDefaultValue(false);
        b.HasIndex(x=>x.Email).IsUnique();
    }
}
