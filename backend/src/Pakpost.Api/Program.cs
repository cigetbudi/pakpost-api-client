using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Pakpost.Api.Middlewares;
using Pakpost.Application;
using Pakpost.Infrastructure;
var builder=WebApplication.CreateBuilder(args);
builder.Services.AddControllers().AddJsonOptions(o=>o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
var signingKey=builder.Configuration["Jwt:SigningKey"];
if(string.IsNullOrWhiteSpace(signingKey) || Encoding.UTF8.GetByteCount(signingKey)<32)
    throw new InvalidOperationException("Jwt__SigningKey must be at least 32 UTF-8 bytes");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o=>
{
    o.MapInboundClaims=false;
    o.TokenValidationParameters=new TokenValidationParameters
    {
        ValidateIssuer=true,ValidIssuer=builder.Configuration["Jwt:Issuer"]??"pakpost",
        ValidateAudience=true,ValidAudience=builder.Configuration["Jwt:Audience"]??"pakpost-client",
        ValidateLifetime=true,ValidateIssuerSigningKey=true,
        IssuerSigningKey=new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
        ClockSkew=TimeSpan.FromSeconds(30)
    };
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(o=>
{
    o.RejectionStatusCode=429;
    o.AddPolicy("public-proxy",c=>RateLimitPartition.GetFixedWindowLimiter(
        c.Connection.RemoteIpAddress?.ToString()??"unknown",_=>new FixedWindowRateLimiterOptions
        {PermitLimit=30,Window=TimeSpan.FromMinutes(1),QueueLimit=0,AutoReplenishment=true}));
    o.AddPolicy("auth",c=>RateLimitPartition.GetFixedWindowLimiter(
        "auth:"+(c.Connection.RemoteIpAddress?.ToString()??"unknown"),_=>new FixedWindowRateLimiterOptions
        {PermitLimit=10,Window=TimeSpan.FromMinutes(1),QueueLimit=0,AutoReplenishment=true}));
});
var origins=builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()??["http://localhost:5173"];
builder.Services.AddCors(o=>o.AddPolicy("Frontend",p=>p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));
var app=builder.Build();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseRouting();
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health",()=>Results.Ok(new{status="ok",service="pakpost-api",mode="anonymous-tester-with-private-workspaces"}));
app.Run();
