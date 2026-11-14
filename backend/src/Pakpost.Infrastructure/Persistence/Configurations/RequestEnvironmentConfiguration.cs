using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Configurations;
public sealed class RequestEnvironmentConfiguration : IEntityTypeConfiguration<RequestEnvironment>
{
    public void Configure(EntityTypeBuilder<RequestEnvironment> b)
    {
        b.ToTable("request_environments", "organization");b.HasKey(x=>x.Id);
        b.Property(x=>x.Name).HasMaxLength(120).IsRequired();
        b.HasIndex(x=>new{x.WorkspaceId,x.Name}).IsUnique();
        b.HasOne<Workspace>().WithMany().HasForeignKey(x=>x.WorkspaceId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x=>x.Variables).WithOne().HasForeignKey(x=>x.EnvironmentId).OnDelete(DeleteBehavior.Cascade);
    }
}
public sealed class RequestEnvironmentVariableConfiguration : IEntityTypeConfiguration<RequestEnvironmentVariable>
{
    public void Configure(EntityTypeBuilder<RequestEnvironmentVariable> b)
    {
        b.ToTable("request_environment_variables", "organization");b.HasKey(x=>x.Id);
        b.Property(x=>x.Key).HasMaxLength(120).IsRequired();
        b.Property(x=>x.StoredValue).HasColumnType("text").IsRequired();
        b.HasIndex(x=>new{x.EnvironmentId,x.Key}).IsUnique();
    }
}
