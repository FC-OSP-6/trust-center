#!/usr/bin/env perl

use v5.16;
use strict;
use warnings;

use IO::Socket::INET;

my %PORT_RANGES = (
  SERVER_PORT   => [4000, 4099],
  VITE_DEV_PORT => [5173, 5199]
);

sub find_available_port {
  my ($start_port, $end_port) = @_;

  for my $port ($start_port .. $end_port) {
    my $socket = IO::Socket::INET->new(
      LocalAddr => '127.0.0.1',
      LocalPort => $port,
      Proto     => 'tcp',
      Listen    => 1,
      ReuseAddr => 0
    );

    next if !$socket;

    close $socket;
    return $port;
  }

  die "No available dev port found in range $start_port-$end_port\n";
}

sub ensure_port_env {
  my ($key) = @_;
  my ($start_port, $end_port) = @{ $PORT_RANGES{$key} // die "Unsupported port env: $key\n" };

  return if defined $ENV{$key} && $ENV{$key} ne '';

  $ENV{$key} = find_available_port($start_port, $end_port);
  say "[dev-port] using $key=$ENV{$key}";
}

sub parse_args {
  my @managed_keys;

  while (@ARGV && $ARGV[0] eq '--manage') {
    shift @ARGV;
    @ARGV or die "Usage: with-dev-port.pl [--manage VAR]... -- <command> [args...]\n";
    push @managed_keys, shift @ARGV;
  }

  @ARGV && $ARGV[0] eq '--'
    or die "Usage: with-dev-port.pl [--manage VAR]... -- <command> [args...]\n";

  shift @ARGV;
  @ARGV or die "Usage: with-dev-port.pl [--manage VAR]... -- <command> [args...]\n";

  @managed_keys or die "At least one --manage VAR is required\n";

  return @managed_keys;
}

my @managed_keys = parse_args();

for my $key (@managed_keys) {
  ensure_port_env($key);
}

exec @ARGV or die "Failed to exec $ARGV[0]: $!\n";
