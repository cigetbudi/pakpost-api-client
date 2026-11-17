using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Configurations;
public sealed class CollectionConfiguration : IEntityTypeConfiguration<Collection>
{
    public void Configure(EntityTypeBuilder<Collection> builder)
    {
        builder.ToTable("collections", "collection");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(120).IsRequired();
        builder.Property(x => x.VariablesJson).HasColumnName("variables_json").HasColumnType("text").HasDefaultValue("[]").IsRequired();
        // Ensures two editors cannot silently overwrite each other's saved variables.
        builder.Property(x => x.VariablesVersion).HasColumnName("variables_version").HasDefaultValue(0).IsConcurrencyToken();
        builder.HasOne<Workspace>().WithMany().HasForeignKey(x => x.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(x => x.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => x.WorkspaceId);
    }
}
